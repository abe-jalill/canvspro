// Client-side wrappers that call the `canvas` Edge Function.
// The Canvas key is stored per-user in `user_settings`; the Edge Function
// reads it server-side, so the browser never needs to hold it.
import { supabase } from "@/integrations/supabase/client";
import { fetchHasCanvasKey } from "@/lib/user-settings";

async function invokeCanvas<T>(
  resource: "courses" | "assignments" | "announcements" | "calendar" | "all",
  extra?: Record<string, unknown>,
): Promise<T> {
  // No key saved yet → render blank states instead of erroring.
  const hasKey = await fetchHasCanvasKey();
  if (!hasKey) return [] as unknown as T;


  const { data, error } = await supabase.functions.invoke("canvas", {
    body: { resource, ...(extra ?? {}) },
  });
  if (error) {
    // supabase-js hides the real reason behind "non-2xx status code";
    // read the response body for the actual server message.
    let message = error.message ?? "Request failed";
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
      if (res.status === 428) return [] as unknown as T;
    }
    if (/428|NO_CANVAS_KEY/.test(message)) return [] as unknown as T;
    throw new Error(message);
  }

  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    const message = (data as { error: string }).error;
    if (message === "NO_CANVAS_KEY") return [] as unknown as T;
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
    grade?: string | null;
    missing?: boolean;
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
let inflight: Promise<CanvasBundle> | null = null;
let inflightAt = 0;
const DEDUPE_MS = 2_000;

export function fetchCanvasBundle(): Promise<CanvasBundle> {
  if (inflight && Date.now() - inflightAt < DEDUPE_MS) return inflight;
  inflightAt = Date.now();
  inflight = invokeCanvas<CanvasBundle | unknown[]>("all")
    .then((raw) => {
      // invokeCanvas returns [] when no Canvas key is saved yet.
      if (Array.isArray(raw)) return EMPTY_BUNDLE;
      const b = raw as CanvasBundle;
      return {
        courses: b.courses ?? [],
        assignments: b.assignments ?? [],
        announcements: b.announcements ?? [],
        calendar: b.calendar ?? [],
        errors: b.errors,
      };
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

// Each getter only fails when ITS OWN section failed, so one bad Canvas
// endpoint shows an error in that section while the rest render normally.
async function section<K extends "courses" | "assignments" | "announcements" | "calendar">(
  key: K,
): Promise<CanvasBundle[K]> {
  const bundle = await fetchCanvasBundle();
  const err = bundle.errors?.[key];
  if (err) throw new Error(err);
  return bundle[key];
}

export const getCoursesFn = () => section("courses");
export const getAllAssignmentsFn = () => section("assignments");
export const getAnnouncementsFn = () => section("announcements");
export const getCalendarEventsFn = () => section("calendar");
