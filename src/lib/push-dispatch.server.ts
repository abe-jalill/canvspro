// Server-side alert generation for background push. Mirrors the in-browser
// rules in src/lib/notification-prefs.ts + use-notification-engine.ts.

import { sendWebPushWithRetry, type PushSubscriptionRecord } from "@/lib/webpush.server";
import { endOfLocalDay, type TonightItem } from "@/lib/countdown-alerts.server";
import { canvasRequestInit } from "@/lib/outbound-policy";

export {
  canvasRequestInit,
  isAllowedCanvasHost,
  isPushServiceEndpoint,
  normalizeCanvasDomain,
} from "@/lib/outbound-policy";

export interface ServerPrefs {
  enabled: boolean;
  due1w: boolean;
  due3d: boolean;
  due2d: boolean;
  due1d: boolean;
  grades: boolean;
  announcements: boolean;
  gradeThreshold: number;
  browserPush: boolean;
  quietEnabled: boolean;
  quietStart: number;
  quietEnd: number;
  countdownClass: boolean;
  countdownLeads: number[];
  countdownTonight: boolean;
  countdownTonightHours: number[];
  badge: boolean;
}

export const SERVER_DEFAULT_PREFS: ServerPrefs = {
  enabled: true,
  due1w: false,
  due3d: true,
  due2d: true,
  due1d: true,
  grades: true,
  announcements: true,
  gradeThreshold: 80,
  browserPush: true,
  quietEnabled: true,
  quietStart: 22,
  quietEnd: 7,
  countdownClass: false,
  countdownLeads: [15],
  countdownTonight: false,
  countdownTonightHours: [18],
  badge: false,
};

const DUE_WINDOWS = [
  { key: "due1w", label: "1 week", hours: 24 * 7 },
  { key: "due3d", label: "3 days", hours: 24 * 3 },
  { key: "due2d", label: "2 days", hours: 24 * 2 },
  { key: "due1d", label: "1 day", hours: 24 },
] as const;

export function isQuiet(prefs: ServerPrefs, offsetMinutes: number, now = new Date()): boolean {
  if (!prefs.quietEnabled) return false;
  const local = new Date(now.getTime() - offsetMinutes * 60_000);
  const h = local.getUTCHours();
  const { quietStart: s, quietEnd: e } = prefs;
  if (s === e) return false;
  return s < e ? h >= s && h < e : h >= s || h < e;
}

/**
 * Whether a queued countdown should still go out under the account's current
 * settings: the class reminder toggle and that exact lead time, or tonight's
 * deadline reminders. Shared by the 5-minute sender and the health check.
 */
export function scheduledAlertAllowed(tag: string, prefs: ServerPrefs): boolean {
  if (tag.startsWith("class:")) {
    return (
      prefs.countdownClass &&
      Array.isArray(prefs.countdownLeads) &&
      prefs.countdownLeads.includes(Number(tag.split(":").pop()))
    );
  }
  return prefs.countdownTonight;
}

export interface Alert {
  id: string;
  title: string;
  body?: string;
  to: string;
  /** App-icon badge count to set on delivery. */
  badge?: number | null;
}

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  workflow_state?: string;
  access_restricted_by_date?: boolean;
}

interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  course_id: number;
  submission?: { submitted_at?: string | null; score?: number | null; graded_at?: string | null };
}

interface CanvasAnnouncement {
  id: number;
  title: string;
  posted_at: string;
  context_code: string;
}

/**
 * Canvas answers throttling with 403 + "Rate Limit Exceeded" — the same status
 * it uses for a bad token. The body is therefore part of the error message so
 * callers never mistake a throttle for a rejected key. Throttles are retried
 * with backoff instead of surfacing at all.
 */
async function canvasFetch<T>(domain: string, token: string, path: string): Promise<T> {
  let lastMessage = "Canvas request failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    // User-Agent and redirect rules for Cloudflare Workers: see canvasRequestInit.
    const res = await fetch(`https://${domain}/api/v1${path}`, canvasRequestInit(token));
    if (res.ok) return (await res.json()) as T;
    if (res.status >= 300 && res.status < 400) {
      throw new Error(`Canvas ${res.status}: redirect to another address was not followed`);
    }
    const body = (await res.text().catch(() => "")).slice(0, 200);
    lastMessage = `Canvas ${res.status}: ${body}`;
    const throttled = res.status === 429 || /rate limit/i.test(body);
    if (!throttled) throw new Error(lastMessage);
    await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
  }
  throw new Error(lastMessage);
}

/** Runs tasks with bounded concurrency so Canvas doesn't throttle us. */
async function mapPooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Counts only (no names or ids), reported by the background check for diagnosis. */
export interface BuildStats {
  courses: number;
  courseErrors: number;
  assignments: number;
  alerts: number;
}

export interface BuildResult {
  alerts: Alert[];
  stats: BuildStats;
  /** Unsubmitted work due before 11:59 PM local time today. */
  tonight: TonightItem[];
}

export async function buildAlertsForUser(
  domain: string,
  token: string,
  prefs: ServerPrefs,
  tzOffsetMinutes = 0,
  /** Course ids this account chose to hide. Per-user, never hardcoded. */
  hiddenCourseIds: Set<number> = new Set<number>(),
  completedIds: Set<string> = new Set<string>(),
): Promise<BuildResult> {
  const alerts: Alert[] = [];
  const tonight: TonightItem[] = [];
  const now = Date.now();
  const endToday = endOfLocalDay(new Date(now), tzOffsetMinutes);

  const stats: BuildStats = { courses: 0, courseErrors: 0, assignments: 0, alerts: 0 };

  // Same rule as the app's Canvas feed (supabase/functions/canvas/course-visibility.ts):
  // enrollment_state=active is Canvas's own answer, so only courses the student
  // chose to hide are dropped. A stricter local check (access_restricted_by_date,
  // workflow_state !== "available") removed real, current classes, so the
  // background check found nothing to send while the open app showed alerts.
  const courses = (
    await canvasFetch<CanvasCourse[]>(
      domain,
      token,
      "/courses?enrollment_state=active&per_page=100",
    )
  ).filter((c) => !hiddenCourseIds.has(c.id));
  stats.courses = courses.length;
  if (courses.length === 0) return { alerts, tonight, stats };

  const perCourse = await mapPooled(courses, 4, async (c) => {
    try {
      const list = await canvasFetch<CanvasAssignment[]>(
        domain,
        token,
        // Section and student due-date overrides, exactly as the app shows them.
        `/courses/${c.id}/assignments?include[]=submission&override_assignment_dates=true&per_page=100&order_by=due_at`,
      );
      return list.map((a) => ({ a, course: c }));
    } catch {
      stats.courseErrors += 1;
      return [] as Array<{ a: CanvasAssignment; course: CanvasCourse }>;
    }
  });
  stats.assignments = perCourse.reduce((sum, list) => sum + list.length, 0);

  for (const { a, course } of perCourse.flat()) {
    // Grades posted in the last day.
    const score = a.submission?.score;
    const gradedAt = a.submission?.graded_at ? new Date(a.submission.graded_at).getTime() : null;
    if (
      prefs.grades &&
      score != null &&
      a.points_possible &&
      gradedAt &&
      now - gradedAt < 26 * 3_600_000
    ) {
      const pct = Math.round((score / a.points_possible) * 100);
      if (pct >= prefs.gradeThreshold) {
        alerts.push({
          id: `grade:${a.id}:${score}`,
          title: `Good job! You scored ${pct}% on ${a.name}`,
          body: course.name,
          to: "/grades",
        });
      }
    }

    if (!a.due_at || a.submission?.submitted_at || completedIds.has(String(a.id))) continue;
    const due = new Date(a.due_at).getTime();
    if (due <= now) continue;
    const hoursLeft = (due - now) / 3_600_000;
    if (due <= endToday) tonight.push({ name: a.name, courseName: course.name });

    for (const w of DUE_WINDOWS) {
      if (!prefs[w.key]) continue;
      if (hoursLeft > w.hours) continue;
      const tighter = DUE_WINDOWS.some(
        (x) => prefs[x.key] && x.hours < w.hours && hoursLeft <= x.hours,
      );
      if (tighter) continue;
      alerts.push({
        id: `due:${a.id}:${w.key}`,
        title: `Due in ${w.label} or less: ${a.name}`,
        body: `${course.name} · due ${new Date(a.due_at).toLocaleString("en-US")}`,
        to: "/assignments",
      });
    }
  }

  if (prefs.announcements) {
    try {
      const params = new URLSearchParams();
      courses.forEach((c) => params.append("context_codes[]", `course_${c.id}`));
      const start = new Date(now - 2 * 24 * 3_600_000);
      params.set("start_date", start.toISOString());
      params.set("per_page", "30");
      const raw = await canvasFetch<CanvasAnnouncement[]>(
        domain,
        token,
        `/announcements?${params.toString()}`,
      );
      const byId = new Map(courses.map((c) => [c.id, c]));
      for (const an of raw) {
        const cid = Number(an.context_code.replace("course_", ""));
        if (hiddenCourseIds.has(cid)) continue;
        if (now - new Date(an.posted_at).getTime() > 26 * 3_600_000) continue;
        alerts.push({
          id: `announcement:${an.id}`,
          title: an.title,
          body: `New announcement · ${byId.get(cid)?.name ?? ""}`.trim(),
          to: "/announcements",
        });
      }
    } catch {
      // announcements are best-effort
    }
  }

  stats.alerts = alerts.length;
  return { alerts, tonight, stats };
}

export interface DeliveryReport {
  /** Subscription ids whose endpoint is gone and should be deleted. */
  dead: string[];
  /** Subscription ids that failed for a non-permanent reason. */
  failed: string[];
  /** Subscription ids that accepted the push. */
  delivered: string[];
}

export async function deliver(
  subs: Array<PushSubscriptionRecord & { id: string }>,
  alert: Alert,
  vapid: { publicKey: string; privateKey: string; subject: string },
): Promise<DeliveryReport> {
  const dead: string[] = [];
  const failed: string[] = [];
  const delivered: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const res = await sendWebPushWithRetry(
        s,
        {
          title: alert.title,
          body: alert.body,
          to: alert.to,
          tag: alert.id,
          badge: alert.badge ?? undefined,
        },
        { ...vapid, context: `alert=${alert.id}` },
      );
      if (res.ok) delivered.push(s.id);
      else if (res.expired) dead.push(s.id);
      else {
        failed.push(s.id);
        console.error(
          `[push-dispatch] giving up sub=${s.id} alert=${alert.id} status=${res.status} attempts=${res.attempts}${
            res.detail ? ` detail=${res.detail}` : ""
          }`,
        );
      }
    }),
  );
  return { dead, failed, delivered };
}
