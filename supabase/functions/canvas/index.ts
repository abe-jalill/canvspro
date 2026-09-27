// Edge Function: proxies Canvas LMS REST API calls using the caller's own
// Canvas API key, stored per-user in the `user_settings` table. The key never
// reaches the browser: the function reads it with the caller's JWT.

import { nextCanvasPagePath } from "./pagination.ts";
import { isCanvasCourseVisible } from "./course-visibility.ts";

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "private, no-store",
  };
}

const API_VERSION = "/api/v1";

/** Normalizes a user-supplied Canvas URL to a bare hostname, e.g.
 *  "https://Yourschool.Instructure.com/" → "yourschool.instructure.com".
 *  Returns "" when the value isn't a plausible hostname. */
function normalizeDomain(raw: string | null | undefined): string {
  let v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  v = v
    .replace(/^https?:\/\//, "")
    .split("/")[0]!
    .split("?")[0]!
    .trim();
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(v)) return "";
  const labels = v.split(".");
  if (labels.some((label) => !label || label.startsWith("-") || label.endsWith("-"))) return "";
  const forbidden = new Set(["local", "localhost", "internal", "home", "lan"]);
  return labels.some((label) => forbidden.has(label)) ? "" : v;
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
  /** Non-secret cache namespace derived from the complete token. */
  cacheScope: string;
  /** Course ids this account chose to hide. Per-user, never hardcoded. */
  excluded: Set<number>;
}

// Short-lived in-memory cache so repeated page views don't re-hit Canvas.
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function cacheKey(creds: Creds, path: string) {
  return `${creds.domain}|${creds.cacheScope}|${path}`;
}

async function tokenFingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
  return cachedCanvasRequest(creds, path, () => canvasFetchRaw<T>(creds, path));
}

async function cachedCanvasRequest<T>(
  creds: Creds,
  requestKey: string,
  load: () => Promise<T>,
): Promise<T> {
  const key = cacheKey(creds, requestKey);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  if (hit) cache.delete(key);
  evictExpired();
  const pending = inflight.get(key);
  if (pending) return (await pending) as T;
  const p = load()
    .then((v) => {
      cache.set(key, { at: Date.now(), value: v });
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p as Promise<unknown>);
  return p;
}

async function canvasFetchPageRaw<T>(
  creds: Creds,
  path: string,
): Promise<{ data: T; nextPath: string | null }> {
  const url = `https://${creds.domain}${API_VERSION}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${creds.token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canvas API ${res.status}: ${text.slice(0, 200)}`);
  }
  return {
    data: (await res.json()) as T,
    nextPath: nextCanvasPagePath(res.headers.get("Link"), creds.domain),
  };
}

async function canvasFetchRaw<T>(creds: Creds, path: string): Promise<T> {
  return (await canvasFetchPageRaw<T>(creds, path)).data;
}

/** Fetch every Canvas page, rather than silently losing everything after the
 * first 100 records. The aggregate is cached and shared like a normal call. */
async function canvasFetchAll<T>(creds: Creds, path: string): Promise<T[]> {
  return cachedCanvasRequest(creds, `all-pages:${path}`, async () => {
    const all: T[] = [];
    let nextPath: string | null = path;
    let pageCount = 0;

    while (nextPath) {
      pageCount += 1;
      if (pageCount > 100) throw new Error("Canvas pagination exceeded 100 pages");
      const page: { data: T[]; nextPath: string | null } =
        await canvasFetchPageRaw<T[]>(creds, nextPath);
      if (!Array.isArray(page.data)) throw new Error("Canvas returned an invalid paginated response");
      all.push(...page.data);
      nextPath = page.nextPath;
    }

    return all;
  });
}

// Reads the caller's Canvas API key from `user_settings` using their JWT,
// so RLS guarantees a user can only ever use their own key.
async function credsForRequest(req: Request, includeHidden = false): Promise<Creds> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("NOT_AUTHENTICATED");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) throw new Error("SERVER_CONFIGURATION_ERROR");

  // Resolve the user from the signed token first, then perform the credential
  // read with the service role and an explicit user filter. Browser clients no
  // longer need SELECT permission on the secret canvas_api_key column.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publicKey, Authorization: authHeader },
  });
  if (!userRes.ok) throw new Error("NOT_AUTHENTICATED");
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) throw new Error("NOT_AUTHENTICATED");

  const adminHeaders: Record<string, string> = { apikey: serviceKey };
  if (!serviceKey.startsWith("sb_secret_")) {
    adminHeaders.Authorization = `Bearer ${serviceKey}`;
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/user_settings?select=canvas_api_key,canvas_domain` +
      `&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    {
      headers: adminHeaders,
    },
  );
  if (!res.ok) throw new Error("SERVER_CONFIGURATION_ERROR");
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
        `${supabaseUrl}/rest/v1/user_preferences?select=value` +
          `&user_id=eq.${encodeURIComponent(user.id)}&key=eq.hidden_course_ids&limit=1`,
        { headers: adminHeaders },
      );
      if (prefRes.ok) {
        const prefRows = (await prefRes.json()) as Array<{ value: unknown }>;
        const value = prefRows?.[0]?.value;
        if (Array.isArray(value)) {
          excluded = new Set(value.map((v) => Number(v)).filter((n) => Number.isFinite(n)));
        }
      }
    } catch {
      // Hiding courses is a preference, not a gate — ignore lookup failures.
    }
  }

  return { domain, token, cacheScope: await tokenFingerprint(token), excluded };
}

async function fetchActiveCourses(creds: Creds): Promise<CanvasCourse[]> {
  const courses = await canvasFetchAll<CanvasCourse>(
    creds,
    "/courses?enrollment_state=active&include[]=total_scores&include[]=syllabus_body&per_page=100",
  );
  // enrollment_state=active is Canvas's source of truth. Do not let a page's
  // date window (or a redundant local workflow-state check) shrink this feed.
  return courses.filter((course) => isCanvasCourseVisible(course, creds.excluded));
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
  const results = await Promise.allSettled(
    courses.map(async (c) => {
      const assignments = await canvasFetchAll<CanvasAssignment>(
        creds,
        `/courses/${c.id}/assignments?include[]=submission&override_assignment_dates=true&per_page=100&order_by=due_at`,
      );
      return assignments.map((a) => ({
        ...a,
        course_name: c.name,
        course_code: c.course_code,
      }));
    }),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (courses.length > 0 && failures.length === courses.length) {
    const reason = failures[0].reason;
    throw reason instanceof Error ? reason : new Error(String(reason));
  }
  for (const failure of failures) {
    console.error(
      "[canvas] assignment course fetch failed:",
      failure.reason instanceof Error ? failure.reason.message : String(failure.reason),
    );
  }
  const list = results
    .filter((result): result is PromiseFulfilledResult<(CanvasAssignment & {
      course_name: string;
      course_code: string;
    })[]> => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter((a) => !creds.excluded.has(a.course_id));

  // Canvas's own "Upcoming"/To-Do list comes from the planner, which also
  // includes ungraded quizzes, discussions and pages with to-do dates that the
  // assignments endpoint never returns. Merge those in (deduped).
  try {
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const start = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const end = new Date(Date.now() + 60 * 86_400_000).toISOString();
    const items = await canvasFetchAll<PlannerItem>(
      creds,
      `/planner/items?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&per_page=100`,
    );
    const seen = new Set(list.map((a) => a.id));
    const typeCode: Record<string, number> = { quiz: 1, discussion_topic: 2, wiki_page: 3, sub_assignment: 4 };
    for (const it of items) {
      const course = it.course_id ? courseById.get(it.course_id) : undefined;
      if (!course || creds.excluded.has(course.id)) continue;
      const p = it.plannable ?? {};
      const assignmentId = it.plannable_type === "assignment" ? it.plannable_id : p.assignment_id;
      if (assignmentId && seen.has(assignmentId)) continue;
      const code = typeCode[it.plannable_type];
      if (!assignmentId && !code) continue; // skip notes, events, announcements
      const id = assignmentId ?? -(it.plannable_id * 10 + code);
      seen.add(id);
      const sub = typeof it.submissions === "object" && it.submissions ? it.submissions : null;
      list.push({
        id,
        name: p.title ?? p.name ?? "Untitled",
        due_at: p.due_at ?? p.todo_date ?? it.plannable_date ?? null,
        html_url: it.html_url ? `https://${creds.domain}${it.html_url.startsWith("/") ? "" : "/"}${it.html_url}` : `https://${creds.domain}/courses/${course.id}`,
        points_possible: p.points_possible ?? null,
        course_id: course.id,
        course_name: course.name,
        course_code: course.course_code,
        submission: sub
          ? {
              submitted_at: sub.submitted ? new Date().toISOString() : null,
              workflow_state: sub.graded ? "graded" : sub.submitted ? "submitted" : "unsubmitted",
              missing: !!sub.missing,
              excused: !!sub.excused,
              late: !!sub.late,
            }
          : it.planner_override?.marked_complete
            ? { workflow_state: "submitted", submitted_at: new Date().toISOString() }
            : undefined,
      } as unknown as (typeof list)[number]);
    }
  } catch (err) {
    console.error("[canvas] planner merge failed:", err instanceof Error ? err.message : String(err));
  }
  return list;
}

interface PlannerItem {
  course_id?: number;
  plannable_id: number;
  plannable_type: string;
  plannable_date?: string;
  html_url?: string;
  plannable?: {
    title?: string; name?: string; due_at?: string | null; todo_date?: string | null;
    points_possible?: number | null; assignment_id?: number;
  };
  submissions?: false | { submitted?: boolean; graded?: boolean; missing?: boolean; excused?: boolean; late?: boolean };
  planner_override?: { marked_complete?: boolean } | null;
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
  const raw = await canvasFetchAll<CanvasAnnouncement>(
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
  const events = await canvasFetchAll<CanvasCalendarEvent>(
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
      days = typeof body?.days === "number" ? Math.min(90, Math.max(1, body.days)) : undefined;
      includeHidden = body?.includeHidden === true;
      // Used only by the "validate" check when saving credentials: the caller's
      // own freshly typed key/URL, verified in-memory and never persisted here.
      overrideDomain = typeof body?.domain === "string" ? body.domain : undefined;
      overrideToken = typeof body?.token === "string" ? body.token : undefined;
    } else {
      const url = new URL(req.url);
      resource = url.searchParams.get("resource");
      const d = url.searchParams.get("days");
      if (d && Number.isFinite(Number(d))) days = Math.min(90, Math.max(1, Number(d)));
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
                return {
                  domain: d,
                  token: overrideToken,
                  cacheScope: "validation",
                  excluded: new Set<number>(),
                };
              })()
            : overrideDomain !== undefined && storedCreds
              ? (() => {
                  // URL-only change: check the saved key against the new URL.
                  const d = normalizeDomain(overrideDomain);
                  if (!d) throw new Error("INVALID_DOMAIN");
                  return { ...storedCreds, domain: d, cacheScope: "validation" };
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
