// Server-only Canvas LMS API client. Never import from a route/client.

const API_VERSION = "/api/v1";

// Courses to always exclude from every widget, page, and derived API call.
const EXCLUDED_COURSE_IDS = new Set<number>([11452, 3465, 6219]);

function base() {
  const domain = process.env.CANVAS_DOMAIN;
  const token = process.env.CANVAS_TOKEN;
  if (!domain || !token) {
    throw new Error("Canvas credentials are not configured on the server.");
  }
  return { domain, token };
}

async function canvasFetch<T>(path: string): Promise<T> {
  const { domain, token } = base();
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

export interface CanvasCourse {
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

export interface CanvasAssignment {
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

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  html_url: string;
  context_code: string;
}

export interface CanvasCalendarEvent {
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

function isActive(c: CanvasCourse) {
  if (EXCLUDED_COURSE_IDS.has(c.id)) return false;
  if (c.access_restricted_by_date) return false;
  if (c.workflow_state && c.workflow_state !== "available") return false;
  return true;
}

export async function fetchActiveCourses(): Promise<CanvasCourse[]> {
  const courses = await canvasFetch<CanvasCourse[]>(
    "/courses?enrollment_state=active&include[]=total_scores&per_page=100",
  );
  return courses.filter(isActive);
}

export async function fetchAssignmentsForCourse(
  courseId: number,
): Promise<CanvasAssignment[]> {
  return canvasFetch<CanvasAssignment[]>(
    `/courses/${courseId}/assignments?include[]=submission&per_page=100&order_by=due_at`,
  );
}

export async function fetchAllAssignments(): Promise<
  Array<CanvasAssignment & { course_name: string; course_code: string }>
> {
  const courses = await fetchActiveCourses();
  const results = await Promise.all(
    courses.map(async (c) => {
      try {
        const assignments = await fetchAssignmentsForCourse(c.id);
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
  // Belt-and-suspenders: also filter by course_id in case anything slipped through.
  return results.flat().filter((a) => !EXCLUDED_COURSE_IDS.has(a.course_id));
}

export async function fetchAnnouncements(
  days = 30,
): Promise<Array<CanvasAnnouncement & { course_id: number; course_name: string; course_code: string }>> {
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

export async function fetchCalendarEvents(
  daysAhead = 14,
): Promise<CanvasCalendarEvent[]> {
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
