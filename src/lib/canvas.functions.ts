// Client-side wrappers that call the `canvas` Edge Function.
// The Canvas token lives only in the Edge Function (as CANVAS_TOKEN); the
// browser never sees it.
import { supabase } from "@/integrations/supabase/client";

async function invokeCanvas<T>(
  resource: "courses" | "assignments" | "announcements" | "calendar",
  extra?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("canvas", {
    body: { resource, ...(extra ?? {}) },
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
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

export const getCoursesFn = () => invokeCanvas<CourseSummary[]>("courses");
export const getAllAssignmentsFn = () =>
  invokeCanvas<AssignmentItem[]>("assignments");
export const getAnnouncementsFn = () =>
  invokeCanvas<AnnouncementItem[]>("announcements", { days: 30 });
export const getCalendarEventsFn = () =>
  invokeCanvas<CalendarEventItem[]>("calendar", { days: 14 });
