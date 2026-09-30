import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCourses from "./tools/list-courses";
import listAssignments from "./tools/list-assignments";
import listAnnouncements from "./tools/list-announcements";
import listCalendarEvents from "./tools/list-calendar-events";

// The app's own auth server issues the access tokens MCP clients present.
const ISSUER = "https://vqmzhzvugzhmtprklzfm.supabase.co/auth/v1";

export default defineMcp({
  name: "canvaspro",
  title: "CanvasPro",
  version: "0.1.0",
  instructions: [
    "Read-only access to one CanvasPro student's Canvas LMS data: courses and current grades,",
    "assignments with due dates and submission status, instructor announcements, and calendar events.",
    "Call list_courses first when you need course ids or grades. Use list_assignments for anything",
    "about deadlines, missing work or study planning. All times are ISO 8601 UTC.",
    "CanvasPro is independent of Canvas LMS and Instructure, Inc.",
  ].join(" "),
  auth: auth.oauth.issuer({
    issuer: ISSUER,
    resource: "https://canvaspro.app/mcp",
    // Supabase mints project-wide audiences for user access tokens.
    acceptedAudiences: ["authenticated"],
    resourceName: "CanvasPro",
    resourceDocumentation: "https://canvaspro.app",
  }),
  tools: [listCourses, listAssignments, listAnnouncements, listCalendarEvents],
});
