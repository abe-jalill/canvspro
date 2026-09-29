// Client-side wrappers that call the `canvas` Edge Function.
// The Canvas key is stored per-user in `user_settings`; the Edge Function
// reads it server-side, so the browser never needs to hold it.
import { supabase } from "@/integrations/supabase/client";
import { clearCanvasKeyInvalidFlag } from "@/lib/canvas-key-health";
import { getUserScope } from "@/lib/user-scope";
import { createRequestCache } from "@/lib/request-cache";
import { isAssignmentComplete } from "@/lib/assignment-window";
import { friendlyCanvasTransportError, invokeCanvasEdge } from "@/lib/canvas-edge-client";
import {
  canvasBundleHasSuccessfulSection,
  friendlyCanvasSectionError,
} from "@/lib/canvas-key-status";

/**
 * Right after sign-in the session can still be settling. Waiting for it (and
 * throwing if it never arrives) means the query RETRIES instead of caching an
 * empty result — the old behaviour that made Grades/Announcements/Dashboard
 * randomly render nothing for minutes after logging in.
 */
async function waitForSession(timeoutMs = 4_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    if (Date.now() >= deadline) throw new Error("Session not ready — please retry.");
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function invokeCanvas<T>(
  resource: "courses" | "assignments" | "announcements" | "calendar" | "all" | "duedates",
  extra?: Record<string, unknown>,
): Promise<T> {
  await waitForSession();

  const { data, error } = await invokeCanvasEdge<T>({ resource, ...(extra ?? {}) });
  if (error) {
    // supabase-js hides the real reason behind "non-2xx status code";
    // read the response body for the actual server message.
    let message = friendlyCanvasTransportError(error.message ?? "Request failed");
    const res = (error as { context?: Response }).context;
    if (res && typeof res.text === "function") {
      const body = await res.text().catch(() => "");
      if (body) {
        try {
          const parsed = JSON.parse(body) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          message = body.slice(0, 300);
        }
      }
      // A missing Canvas key/URL renders the setup state, not an error banner.
      if (res.status === 428) return [] as unknown as T;
    }
    if (/428|NO_CANVAS_KEY|NO_CANVAS_DOMAIN/.test(message)) return [] as unknown as T;
    throw new Error(message);
  }

  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    const message = (data as { error: string }).error;
    if (message === "NO_CANVAS_KEY" || message === "NO_CANVAS_DOMAIN") return [] as unknown as T;
    throw new Error(message);
  }
  return data as T;
}

export interface CourseSummary {
  id: number;
  name: string;
  course_code: string;
  current_score: number | null;
  current_grade: string | null;
  final_score: number | null;
  syllabus_body: string | null;
}

export interface AssignmentItem {
  id: number;
  name: string;
  description?: string | null;
  due_at: string | null;
  html_url: string;
  points_possible: number | null;
  course_id: number;
  course_name: string;
  course_code: string;
  submission?: {
    workflow_state?: string;
    submitted_at?: string | null;
    score?: number | null;
    graded_at?: string | null;
    grade?: string | null;
    missing?: boolean;
    excused?: boolean;
    late?: boolean;
  };
}

export interface AnnouncementItem {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  html_url: string;
  context_code: string;
  course_id: number;
  course_name: string;
  course_code: string;
}

export interface CalendarEventItem {
  id: number | string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  type?: string;
  html_url?: string;
  context_name?: string;
  context_code?: string;
  location_name?: string | null;
}

export interface CanvasBundle {
  courses: CourseSummary[];
  assignments: AssignmentItem[];
  announcements: AnnouncementItem[];
  calendar: CalendarEventItem[];
  /** Per-section failures: other sections still hold good data. */
  errors?: Partial<Record<"courses" | "assignments" | "announcements" | "calendar", string>>;
}

const EMPTY_BUNDLE: CanvasBundle = {
  courses: [],
  assignments: [],
  announcements: [],
  calendar: [],
};

// All four Canvas datasets come back in ONE request. Concurrent callers
// (the four page queries, prefetch, sync) share a single in-flight promise,
// so a full app load hits the network once instead of four times.
const bundleRequests = createRequestCache<CanvasBundle>(10_000);

export function resetCanvasBundle() {
  bundleRequests.clear();
}

export * from "./canvas.queries";

export function fetchCanvasBundle(): Promise<CanvasBundle> {
  const scope = getUserScope();
  return bundleRequests.get(scope, () =>
    invokeCanvas<CanvasBundle | unknown[]>("all").then((raw) => {
      if (getUserScope() !== scope) throw new Error("Session changed — please retry.");
      // invokeCanvas returns [] when no Canvas key is saved yet.
      if (Array.isArray(raw)) return EMPTY_BUNDLE;
      const b = raw as CanvasBundle;
      // Any successfully completed Canvas section proves authentication works,
      // even when that section legitimately contains zero courses/items.
      // Drop any stale rejection left by an older background notification run.
      if (canvasBundleHasSuccessfulSection(b.errors)) void clearCanvasKeyInvalidFlag();
      return {
        courses: b.courses ?? [],
        assignments: b.assignments ?? [],
        announcements: b.announcements ?? [],
        calendar: b.calendar ?? [],
        errors: b.errors,
      };
    }),
  );
}

// Each getter only fails when ITS OWN section failed, so one bad Canvas
// endpoint shows an error in that section while the rest render normally.
/** Turns a raw Canvas error body into a message a student can act on. */
async function section<K extends "courses" | "assignments" | "announcements" | "calendar">(
  key: K,
): Promise<CanvasBundle[K]> {
  const bundle = await fetchCanvasBundle();
  const err = bundle.errors?.[key];
  if (err) throw new Error(friendlyCanvasSectionError(err));
  return bundle[key];
}

export const getCoursesFn = () => section("courses");

/** Every active course, including the ones this account chose to hide.
 *  Used by the Settings editor so hidden classes can be brought back. */
export async function getAllCoursesIncludingHidden(): Promise<CourseSummary[]> {
  const raw = await invokeCanvas<CourseSummary[]>("courses", { includeHidden: true });
  return Array.isArray(raw) ? raw : [];
}
export const getAllAssignmentsFn = () => section("assignments");

/** Free-tier due timestamps: ids and due dates only, no assignment details. */
export interface DueDateItem {
  id: number;
  course_id: number;
  due_at: string | null;
  submitted: boolean;
}

export async function getDueDatesFn(): Promise<DueDateItem[]> {
  return (await getAllAssignmentsFn()).map((a) => ({
    id: a.id,
    course_id: a.course_id,
    due_at: a.due_at,
    submitted: isAssignmentComplete(a, false),
  }));
}
export const getAnnouncementsFn = () => section("announcements");
export const getCalendarEventsFn = () => section("calendar");
