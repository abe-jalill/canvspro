// Edge Function: proxies Canvas LMS REST API calls using the CANVAS_TOKEN
// and CANVAS_DOMAIN secrets. The frontend calls this function instead of
// hitting Canvas directly, so the token never reaches the browser.

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

function creds() {
  const domain = Deno.env.get("CANVAS_DOMAIN");
  const token = Deno.env.get("CANVAS_TOKEN");
  if (!domain || !token) {
    throw new Error("Canvas credentials are not configured on the server.");
  }
  return { domain, token };
}

async function canvasFetch<T>(path: string): Promise<T> {
  const { domain, token } = creds();
  const url = `https://${domain}${API_VERSION}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canvas API ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function isActive(c: CanvasCourse) {
  if (EXCLUDED_COURSE_IDS.has(c.id)) return false;
  if (c.access_restricted_by_date) return false;
  if (c.workflow_state && c.workflow_state !== "available") return false;
  return true;
}

async function fetchActiveCourses(): Promise<CanvasCourse[]> {
  const courses = await canvasFetch<CanvasCourse[]>(
    "/courses?enrollment_state=active&include[]=total_scores&per_page=100",
  );
  return courses.filter(isActive);
}

async function handleCourses() {
  const courses = await fetchActiveCourses();
  return courses.map((c) => {
    const enr =
      c.enrollments?.find((e) => e.type === "student") ?? c.enrollments?.[0];
    return {
      id: c.id,
      name: c.name,
      course_code: c.course_code,
      current_score: enr?.computed_current_score ?? null,
      current_grade: enr?.computed_current_grade ?? null,
      final_score: enr?.computed_final_score ?? null,
    };
  });
}

async function handleAssignments() {
  const courses = await fetchActiveCourses();
  const results = await Promise.all(
    courses.map(async (c) => {
      try {
        const assignments = await canvasFetch<CanvasAssignment[]>(
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

async function handleAnnouncements(days = 30) {
  const courses = await fetchActiveCourses();
  if (courses.length === 0) return [];
  const params = new URLSearchParams();
  courses.forEach((c) => params.append("context_codes[]", `course_${c.id}`));
  const start = new Date();
  start.setDate(start.getDate() - days);
  params.set("start_date", start.toISOString());
  params.set("per_page", "50");
  const raw = await canvasFetch<CanvasAnnouncement[]>(
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

async function handleCalendar(daysAhead = 14) {
  const courses = await fetchActiveCourses();
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

  const events = await canvasFetch<CanvasCalendarEvent[]>(
    `/calendar_events?${params.toString()}`,
  );
  const assignmentParams = new URLSearchParams(params);
  assignmentParams.set("type", "assignment");
  const assignmentEvents = await canvasFetch<CanvasCalendarEvent[]>(
    `/calendar_events?${assignmentParams.toString()}`,
  );
  const all = [...events, ...assignmentEvents];
  return all.filter((e) => {
    if (!e.context_code) return true;
    const id = Number(e.context_code.replace("course_", ""));
    return !Number.isFinite(id) || !EXCLUDED_COURSE_IDS.has(id);
  });
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

    let data: unknown;
    switch (resource) {
      case "courses":
        data = await handleCourses();
        break;
      case "assignments":
        data = await handleAssignments();
        break;
      case "announcements":
        data = await handleAnnouncements(days ?? 30);
        break;
      case "calendar":
        data = await handleCalendar(days ?? 14);
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
    console.error("[canvas]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
