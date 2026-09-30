// Server-side Canvas reader for the MCP server.
//
// The MCP caller authenticates with an OAuth access token minted by this app's
// own auth server, which is the same Supabase user JWT the app itself uses.
// So the token can be forwarded straight to the `canvas` Edge Function, which
// looks up that student's stored Canvas URL + API key and does the fetching.
// No Canvas credential ever passes through the MCP layer.
import { ToolError } from "@lovable.dev/mcp-js";

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  current_score: number | null;
  current_grade: string | null;
}

export interface CanvasAssignment {
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
    excused?: boolean;
    late?: boolean;
  };
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  html_url: string;
  course_name: string;
  course_code: string;
}

export interface CanvasCalendarEvent {
  id: number | string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  location_name?: string | null;
  context_name?: string;
}

export interface CanvasBundle {
  courses: CanvasCourse[];
  assignments: CanvasAssignment[];
  announcements: CanvasAnnouncement[];
  calendar: CanvasCalendarEvent[];
  errors?: Record<string, string>;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new ToolError("CanvasPro is not configured to reach its backend right now.");
  return value;
}

/** One request returns courses, assignments, announcements and calendar. */
export async function fetchCanvasBundle(
  token: string | undefined,
  signal?: AbortSignal,
): Promise<CanvasBundle> {
  if (!token) throw new ToolError("Sign in to CanvasPro to let this assistant read your classes.");

  const url = `${env("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/canvas`;
  const apikey = env("SUPABASE_PUBLISHABLE_KEY");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resource: "all" }),
      signal,
    });
  } catch {
    throw new ToolError("Couldn't reach CanvasPro's Canvas service. Try again in a moment.");
  }

  const body = await response.text();

  if (response.status === 401) {
    throw new ToolError("This CanvasPro connection is no longer valid. Reconnect the app.");
  }
  if (response.status === 428) {
    throw new ToolError(
      "No Canvas connection saved yet. Add your school's Canvas address and API key in CanvasPro settings first.",
    );
  }
  if (!response.ok) {
    let message = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* keep the raw snippet */
    }
    if (/NO_CANVAS_KEY|NO_CANVAS_DOMAIN/.test(message)) {
      throw new ToolError(
        "No Canvas connection saved yet. Add your school's Canvas address and API key in CanvasPro settings first.",
      );
    }
    throw new ToolError(`Canvas request failed: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ToolError("Canvas returned an unreadable response.");
  }

  if (Array.isArray(parsed)) {
    return { courses: [], assignments: [], announcements: [], calendar: [] };
  }

  const bundle = parsed as Partial<CanvasBundle>;
  return {
    courses: bundle.courses ?? [],
    assignments: bundle.assignments ?? [],
    announcements: bundle.announcements ?? [],
    calendar: bundle.calendar ?? [],
    ...(bundle.errors ? { errors: bundle.errors } : {}),
  };
}

/** Canvas says an assignment is done when it's submitted, graded or excused. */
export function isSubmitted(a: CanvasAssignment): boolean {
  const s = a.submission;
  if (!s) return false;
  if (s.excused) return true;
  if (s.submitted_at) return true;
  return s.workflow_state === "graded" || s.workflow_state === "submitted";
}

export function stripHtml(html: string, max = 600): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Tools answer with readable text plus the same data as JSON. */
export function reply(summary: string, data: unknown) {
  return {
    content: [
      { type: "text" as const, text: summary },
      { type: "text" as const, text: JSON.stringify(data) },
    ],
  };
}
