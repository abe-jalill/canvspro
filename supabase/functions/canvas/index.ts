// Edge Function: proxies Canvas LMS REST API calls using the caller's own
// Canvas API key, stored per-user in the `user_settings` table. The key never
// reaches the browser: the function reads it with the caller's JWT.

const ALLOWED_ORIGINS = [
  "https://canvaspro.app",
  "https://www.canvaspro.app",
  "https://canvaspremium.lovable.app",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  let allow = ALLOWED_ORIGINS[0];
  if (
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin)
  ) {
    allow = origin;
  }
  return {
    "Access-Control-Allow-Origin": allow,
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

const API_VERSION = "/api/v1";

/** Normalizes a user-supplied Canvas URL to a bare hostname, e.g.
 *  "https://Yourschool.Instructure.com/" → "yourschool.instructure.com".
 *  Returns "" when the value isn't a plausible hostname. */
function normalizeDomain(raw: string | null | undefined): string {
  let v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  v = v.replace(/^https?:\/\//, "").split("/")[0]!.split("?")[0]!.trim();
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(v) ? v : "";
}

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
    graded_at?: string | null;
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
  /** Course ids this account chose to hide. Per-user, never hardcoded. */
  excluded: Set<number>;
}

// Short-lived in-memory cache so repeated page views don't re-hit Canvas.
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function cacheKey(creds: Creds, path: string) {
  return `${creds.domain}|${creds.token.slice(-10)}|${path}`;
}

/** Expired entries are evicted, plus a hard ceiling, so the cache can't grow
 *  without bound over the lifetime of a warm function instance. */
const CACHE_MAX_ENTRIES = 500;
function evictExpired() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.at >= CACHE_TTL_MS) cache.delete(k);
  }
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldestFirst = [...cache.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [k] of oldestFirst.slice(0, cache.size - CACHE_MAX_ENTRIES)) {
      cache.delete(k);
    }
  }
}

async function canvasFetch<T>(creds: Creds, path: string): Promise<T> {
  const key = cacheKey(creds, path);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  if (hit) cache.delete(key);
  evictExpired();
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
async function credsForRequest(req: Request, includeHidden = false): Promise<Creds> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) throw new Error("NOT_AUTHENTICATED");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const apiKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/user_settings?select=canvas_api_key,canvas_domain&limit=1`,
    {
      headers: { apikey: apiKey, Authorization: authHeader },
    },
  );
  if (!res.ok) throw new Error("NOT_AUTHENTICATED");
  const rows = (await res.json()) as Array<{
    canvas_api_key: string | null;
    canvas_domain: string | null;
  }>;
  const token = rows?.[0]?.canvas_api_key?.trim();
  if (!token) throw new Error("NO_CANVAS_KEY");

  // The caller's own school URL wins; the global default keeps existing
  // accounts working until they save their own.
  const domain =
    normalizeDomain(rows?.[0]?.canvas_domain) || normalizeDomain(Deno.env.get("CANVAS_DOMAIN"));
  if (!domain) throw new Error("NO_CANVAS_DOMAIN");

  let excluded = new Set<number>();
  if (!includeHidden) {
    try {
      const prefRes = await fetch(
        `${supabaseUrl}/rest/v1/user_preferences?select=value&key=eq.hidden_course_ids&limit=1`,
        { headers: { apikey: apiKey, Authorization: authHeader } },
      );
      if (prefRes.ok) {
        const prefRows = (await prefRes.json()) as Array<{ value: unknown }>;
        const value = prefRows?.[0]?.value;
        if (Array.isArray(value)) {
          excluded = new Set(
            value.map((v) => Number(v)).filter((n) => Number.isFinite(n)),
          );
        }
      }
    } catch {
      // Hiding courses is a preference, not a gate — ignore lookup failures.
    }
  }

  return { domain, token, excluded };
}

function isActive(c: CanvasCourse, excluded: Set<number>) {
  if (excluded.has(c.id)) return false;
  if (c.access_restricted_by_date) return false;
  if (c.workflow_state && c.workflow_state !== "available") return false;
  return true;
}

async function fetchActiveCourses(creds: Creds): Promise<CanvasCourse[]> {
  const courses = await canvasFetch<CanvasCourse[]>(
    creds,
    "/courses?enrollment_state=active&include[]=total_scores&include[]=syllabus_body&per_page=100",
  );
  return courses.filter((c) => isActive(c, creds.excluded));
}

async function handleCourses(creds: Creds) {
  const courses = await fetchActiveCourses(creds);
  const detailed = await Promise.all(
    courses.map(async (course) => {
      if ((course.syllabus_body ?? "").trim()) return course;
      try {
        return await canvasFetch<CanvasCourse>(
          creds,
          `/courses/${course.id}?include[]=total_scores&include[]=syllabus_body`,
        );
      } catch {
        return course;
      }
    }),
  );
  return detailed.map((c) => {
    const enr = c.enrollments?.find((e) => e.type === "student") ?? c.enrollments?.[0];
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
  return results.flat().filter((a) => !creds.excluded.has(a.course_id));
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
  const raw = await canvasFetch<CanvasAnnouncement[]>(creds, `/announcements?${params.toString()}`);
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
    .filter((a) => !creds.excluded.has(a.course_id));
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
    return !Number.isFinite(id) || !creds.excluded.has(id);
  });
}

// Small due-date summary used by the dashboard countdown.
async function handleDueDates(creds: Creds) {
  const assignments = await handleAssignments(creds);
  return assignments.map((a) => ({
    id: a.id,
    course_id: a.course_id,
    due_at: a.due_at,
    submitted: !!a.submission?.submitted_at,
  }));
}

Deno.serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    let resource: string | null = null;
    let days: number | undefined;
    let includeHidden = false;
    let overrideDomain: string | undefined;
    let overrideToken: string | undefined;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      resource = body?.resource ?? null;
      days = typeof body?.days === "number" ? body.days : undefined;
      includeHidden = body?.includeHidden === true;
      // Used only by the "validate" check when saving credentials: the caller's
      // own freshly typed key/URL, verified in-memory and never persisted here.
      overrideDomain = typeof body?.domain === "string" ? body.domain : undefined;
      overrideToken = typeof body?.token === "string" ? body.token : undefined;
    } else {
      const url = new URL(req.url);
      resource = url.searchParams.get("resource");
      const d = url.searchParams.get("days");
      if (d) days = Number(d);
      includeHidden = url.searchParams.get("includeHidden") === "true";
    }

    // The stored credentials aren't needed when validating a freshly typed
    // pair (the caller may not have saved a key yet), so load them lazily.
    const storedCreds =
      resource === "validate" && overrideToken ? null : await credsForRequest(req, includeHidden);

    let data: unknown;
    switch (resource) {
      case "validate": {
        // Verifies a Canvas URL + API key pair against /users/self. With an
        // override pair supplied, nothing is read from or written to storage.
        const vCreds: Creds =
          overrideToken && storedCreds === null
            ? (() => {
                const d = normalizeDomain(overrideDomain);
                if (!d) throw new Error("INVALID_DOMAIN");
                return { domain: d, token: overrideToken, excluded: new Set<number>() };
              })()
            : storedCreds!;
        const me = await canvasFetchRaw<{ name?: string }>(vCreds, "/users/self");
        data = { ok: true, name: me?.name ?? null };
        break;
      }
      case "all": {
        // Single round trip for the whole app: the shared course lookup is
        // deduped by the in-memory canvasFetch cache. One failing section
        // must NOT blank the others, so each settles independently and its
        // error is reported per-section.
        const settled = await Promise.allSettled([
          handleCourses(storedCreds),
          handleAssignments(storedCreds),
          handleAnnouncements(storedCreds, 30),
          handleCalendar(storedCreds, 14),
        ]);
        const names = ["courses", "assignments", "announcements", "calendar"] as const;
        const bundle: Record<string, unknown> = {};
        const errors: Record<string, string> = {};
        settled.forEach((r, i) => {
          const name = names[i];
          if (r.status === "fulfilled") {
            bundle[name] = r.value;
          } else {
            bundle[name] = [];
            const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
            // Auth / missing-key problems affect everything: surface them as-is.
            if (
              msg === "NOT_AUTHENTICATED" ||
              msg === "NO_CANVAS_KEY" ||
              msg === "NO_CANVAS_DOMAIN"
            )
              throw r.reason;
            errors[name] = msg;
            console.error(`[canvas] ${name}:`, msg);
          }
        });
        data = Object.keys(errors).length > 0 ? { ...bundle, errors } : bundle;
        break;
      }
      case "courses":
        data = await handleCourses(storedCreds);
        break;
      case "assignments":
        data = await handleAssignments(storedCreds);
        break;
      case "announcements":
        data = await handleAnnouncements(storedCreds, days ?? 30);
        break;
      case "calendar":
        data = await handleCalendar(storedCreds, days ?? 14);
        break;
      case "duedates":
        data = await handleDueDates(storedCreds);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown resource: ${resource}` }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message === "NOT_AUTHENTICATED"
        ? 401
        : message === "NO_CANVAS_KEY" || message === "NO_CANVAS_DOMAIN"
            ? 428
            : message === "INVALID_DOMAIN" || /^Canvas API 4\d\d/.test(message)
              ? 400
              : 500;
    if (status === 500) console.error("[canvas]", message);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
