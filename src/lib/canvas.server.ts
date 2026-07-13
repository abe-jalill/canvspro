// Server-only Canvas LMS API client. Never import from a route/client.

const API_VERSION = "/api/v1";

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
  location_name?: string | null;
}

function isActive(c: CanvasCourse) {
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
  Array<CanvasAssignment & { course_name: string }>
> {
  const courses = await fetchActiveCourses();
  const results = await Promise.all(
    courses.map(async (c) => {
      try {
        const assignments = await fetchAssignmentsForCourse(c.id);
        return assignments.map((a) => ({ ...a, course_name: c.name }));
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

export async function fetchAnnouncements(
  days = 30,
): Promise<CanvasAnnouncement[]> {
  const courses = await fetchActiveCourses();
  if (courses.length === 0) return [];
  const params = new URLSearchParams();
  courses.forEach((c) => params.append("context_codes[]", `course_${c.id}`));
  const start = new Date();
  start.setDate(start.getDate() - days);
  params.set("start_date", start.toISOString());
  params.set("per_page", "50");
  return canvasFetch<CanvasAnnouncement[]>(`/announcements?${params.toString()}`);
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
  // Also fetch assignment-type calendar events
  const assignmentParams = new URLSearchParams(params);
  assignmentParams.set("type", "assignment");
  const assignmentEvents = await canvasFetch<CanvasCalendarEvent[]>(
    `/calendar_events?${assignmentParams.toString()}`,
  );
  return [...events, ...assignmentEvents];
}
