// Edge Function: proxies Canvas LMS REST API calls using the caller's own
// Canvas API key, stored per-user in the `user_settings` table. The key never
// reaches the browser: the function reads it with the caller's JWT.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const EXCLUDED_COURSE_IDS = new Set<number>([11452, 3465, 6219]);
const API_VERSION = "/api/v1";

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  workflow_state?: string;
  access_restricted_by_date?: boolean;
  syllabus_body?: string | null;
  enrollments?: Array<{
    type: string;
    computed_current_score?: number | null;
    computed_current_grade?: string | null;
    computed_final_score?: number | null;
  }>;
}

interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  html_url: string;
  points_possible: number | null;
  course_id: number;
  submission?: {
    workflow_state?: string;
    submitted_at?: string | null;
    score?: number | null;
    grade?: string | null;
    missing?: boolean;
    late?: boolean;
  };
}

interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  html_url: string;
  context_code: string;
}

interface CanvasCalendarEvent {
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

interface Creds {
  domain: string;
  token: string;
}

// Short-lived in-memory cache so repeated page views don't re-hit Canvas.
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function cacheKey(creds: Creds, path: string) {
  return `${creds.domain}|${creds.token.slice(-10)}|${path}`;
}

async function canvasFetch<T>(creds: Creds, path: string): Promise<T> {
  const key = cacheKey(creds, path);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return (await pending) as T;
  const p = canvasFetchRaw<T>(creds, path)
    .then((v) => {
      cache.set(key, { at: Date.now(), value: v });
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p as Promise<unknown>);
  return p;
}

async function canvasFetchRaw<T>(creds: Creds, path: string): Promise<T> {
  const url = `https://${creds.domain}${API_VERSION}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${creds.token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canvas API ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// Reads the caller's Canvas API key from `user_settings` using their JWT,
// so RLS guarantees a user can only ever use their own key.
async function credsForRequest(req: Request): Promise<Creds> {
  const domain = Deno.env.get("CANVAS_DOMAIN");
  if (!domain) throw new Error("Canvas domain is not configured.");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) throw new Error("NOT_AUTHENTICATED");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const apiKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY")!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/user_settings?select=canvas_api_key&limit=1`,
    { headers: { apikey: apiKey, Authorization: authHeader } },
  );
  if (!res.ok) throw new Error("NOT_AUTHENTICATED");
  const rows = (await res.json()) as Array<{ canvas_api_key: string | null }>;
  const token = rows?.[0]?.canvas_api_key?.trim();
  if (!token) throw new Error("NO_CANVAS_KEY");
  return { domain, token };
}

function isActive(c: CanvasCourse) {
  if (EXCLUDED_COURSE_IDS.has(c.id)) return false;
  if (c.access_restricted_by_date) return false;
  if (c.workflow_state && c.workflow_state !== "available") return false;
  return true;
}

async function fetchActiveCourses(creds: Creds): Promise<CanvasCourse[]> {
  const courses = await canvasFetch<CanvasCourse[]>(
    creds,
    "/courses?enrollment_state=active&include[]=total_scores&include[]=syllabus_body&per_page=100",
  );
  return courses.filter(isActive);
}

async function handleCourses(creds: Creds) {
  const courses = await fetchActiveCourses(creds);
  return courses.map((c) => {
    const enr =
      c.enrollments?.find((e) => e.type === "student") ?? c.enrollments?.[0];
    const syllabus = (c.syllabus_body ?? "").trim();
    return {
      id: c.id,
      name: c.name,
      course_code: c.course_code,
      current_score: enr?.computed_current_score ?? null,
      current_grade: enr?.computed_current_grade ?? null,
      final_score: enr?.computed_final_score ?? null,
      syllabus_body: syllabus.length > 0 ? c.syllabus_body : null,
    };
  });
}

async function handleAssignments(creds: Creds) {
  const courses = await fetchActiveCourses(creds);
  const results = await Promise.all(
    courses.map(async (c) => {
      try {
        const assignments = await canvasFetch<CanvasAssignment[]>(
          creds,
          `/courses/${c.id}/assignments?include[]=submission&per_page=100&order_by=due_at`,
        );
        return assignments.map((a) => ({
          ...a,
          course_name: c.name,
          course_code: c.course_code,
        }));
      } catch {
        return [];
      }
    }),
  );
  return results.flat().filter((a) => !EXCLUDED_COURSE_IDS.has(a.course_id));
}

async function handleAnnouncements(creds: Creds, days = 30) {
  const courses = await fetchActiveCourses(creds);
  if (courses.length === 0) return [];
  const params = new URLSearchParams();
  courses.forEach((c) => params.append("context_codes[]", `course_${c.id}`));
  const start = new Date();
  start.setDate(start.getDate() - days);
  params.set("start_date", start.toISOString());
  params.set("per_page", "50");
  const raw = await canvasFetch<CanvasAnnouncement[]>(
    creds,
    `/announcements?${params.toString()}`,
  );
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return raw
    .map((a) => {
      const id = Number(a.context_code.replace("course_", ""));
      const course = courseById.get(id);
      return {
        ...a,
        course_id: id,
        course_name: course?.name ?? "Unknown course",
        course_code: course?.course_code ?? "",
      };
    })
    .filter((a) => !EXCLUDED_COURSE_IDS.has(a.course_id));
}

async function handleCalendar(creds: Creds, daysAhead = 14) {
  const courses = await fetchActiveCourses(creds);
  if (courses.length === 0) return [];
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + daysAhead);
  const params = new URLSearchParams();
  courses.forEach((c) => params.append("context_codes[]", `course_${c.id}`));
  params.set("start_date", start.toISOString());
  params.set("end_date", end.toISOString());
  params.set("per_page", "100");
  params.set("type", "event");

  // Only fetch real calendar events here. Assignment due dates are merged
  // client-side from the assignments endpoint, so fetching type=assignment
  // would duplicate every assignment on the schedule page.
  const events = await canvasFetch<CanvasCalendarEvent[]>(
    creds,
    `/calendar_events?${params.toString()}`,
  );
  return events.filter((e) => {
    if (!e.context_code) return true;
    const id = Number(e.context_code.replace("course_", ""));
    return !Number.isFinite(id) || !EXCLUDED_COURSE_IDS.has(id);
  });
}

// Derives the recurring weekly class timetable from Canvas calendar events.
// Canvas stores each class meeting as its own event, so we group events by
// (course, weekday, start/end time) and treat repeated groups as weekly slots.
const DAY_CODES = ["U", "M", "T", "W", "R", "F", "S"] as const;

interface DerivedSession {
  key: string;
  course_id: number;
  course_name: string;
  course_code: string;
  title: string;
  location: string | null;
  days: string[];
  startMinutes: number;
  endMinutes: number;
  occurrences: number;
  recurring: boolean;
  firstDate: string;
  lastDate: string;
}

async function handleClassSchedule(creds: Creds, weeksAhead = 6) {
  const courses = await fetchActiveCourses(creds);
  if (courses.length === 0) return { sessions: [], generated_at: new Date().toISOString() };

  const start = new Date();
  start.setDate(start.getDate() - 7);
  const end = new Date();
  end.setDate(end.getDate() + weeksAhead * 7);

  const params = new URLSearchParams();
  courses.forEach((c) => params.append("context_codes[]", `course_${c.id}`));
  params.set("start_date", start.toISOString());
  params.set("end_date", end.toISOString());
  params.set("per_page", "100");
  params.set("type", "event");

  const events = await canvasFetch<CanvasCalendarEvent[]>(
    creds,
    `/calendar_events?${params.toString()}`,
  );

  const courseById = new Map(courses.map((c) => [c.id, c]));
  type Group = DerivedSession & { dayCounts: Record<string, number> };
  const groups = new Map<string, Group>();

  for (const e of events) {
    if (!e.start_at || !e.end_at) continue;
    const id = Number((e.context_code ?? "").replace("course_", ""));
    if (!Number.isFinite(id) || EXCLUDED_COURSE_IDS.has(id)) continue;
    const course = courseById.get(id);
    if (!course) continue;

    const s = new Date(e.start_at);
    const en = new Date(e.end_at);
    const startMinutes = s.getHours() * 60 + s.getMinutes();
    const endMinutes = en.getHours() * 60 + en.getMinutes();
    if (endMinutes <= startMinutes) continue;
    const day = DAY_CODES[s.getDay()];
    const title = (e.title ?? "").trim() || course.name;
    const key = `${id}|${title.toLowerCase()}|${startMinutes}|${endMinutes}`;

    const existing = groups.get(key);
    if (existing) {
      existing.occurrences += 1;
      existing.dayCounts[day] = (existing.dayCounts[day] ?? 0) + 1;
      if (e.start_at < existing.firstDate) existing.firstDate = e.start_at;
      if (e.start_at > existing.lastDate) existing.lastDate = e.start_at;
      if (!existing.location && e.location_name) existing.location = e.location_name;
    } else {
      groups.set(key, {
        key,
        course_id: id,
        course_name: course.name,
        course_code: course.course_code,
        title,
        location: e.location_name ?? null,
        days: [],
        startMinutes,
        endMinutes,
        occurrences: 1,
        recurring: false,
        firstDate: e.start_at,
        lastDate: e.start_at,
        dayCounts: { [day]: 1 },
      });
    }
  }

  const all: DerivedSession[] = Array.from(groups.values()).map((g) => {
    const days = DAY_CODES.filter((d) => (g.dayCounts[d] ?? 0) > 0) as unknown as string[];
    const { dayCounts: _drop, ...rest } = g;
    return { ...rest, days, recurring: g.occurrences > 1 };
  });

  // Prefer clearly recurring slots; fall back to one-offs for courses that
  // have no repeating meetings so the page is never empty for them.
  const recurringCourseIds = new Set(
    all.filter((s) => s.recurring).map((s) => s.course_id),
  );
  const sessions = all
    .filter((s) => s.recurring || !recurringCourseIds.has(s.course_id))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  return { sessions, generated_at: new Date().toISOString() };
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    let resource: string | null = null;
    let days: number | undefined;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      resource = body?.resource ?? null;
      days = typeof body?.days === "number" ? body.days : undefined;
    } else {
      const url = new URL(req.url);
      resource = url.searchParams.get("resource");
      const d = url.searchParams.get("days");
      if (d) days = Number(d);
    }

    const creds = await credsForRequest(req);

    let data: unknown;
    switch (resource) {
      case "courses":
        data = await handleCourses(creds);
        break;
      case "assignments":
        data = await handleAssignments(creds);
        break;
      case "announcements":
        data = await handleAnnouncements(creds, days ?? 30);
        break;
      case "calendar":
        data = await handleCalendar(creds, days ?? 14);
        break;
      case "class_schedule":
        data = await handleClassSchedule(creds);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown resource: ${resource}` }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          },
        );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message === "NOT_AUTHENTICATED" ? 401 : message === "NO_CANVAS_KEY" ? 428 : 500;
    if (status === 500) console.error("[canvas]", message);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
