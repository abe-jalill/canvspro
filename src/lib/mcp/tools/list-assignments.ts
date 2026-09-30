import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchCanvasBundle, isSubmitted, reply } from "../canvas";

export default defineTool({
  name: "list_assignments",
  title: "List assignments",
  description:
    "List the student's Canvas assignments with due dates, points and whether they are turned in. Defaults to work due in the next 14 days that is not yet submitted. Use this for questions about what is due, upcoming deadlines, missing work, or study planning.",
  annotations: { readOnlyHint: true, openWorldHint: true },
  inputSchema: {
    days_ahead: z
      .number()
      .int()
      .min(1)
      .max(180)
      .optional()
      .describe("How many days ahead to include. Default 14."),
    include_submitted: z
      .boolean()
      .optional()
      .describe("Include assignments already turned in or graded. Default false."),
    include_overdue: z
      .boolean()
      .optional()
      .describe("Include past-due assignments that are still not turned in. Default true."),
    course_id: z.number().int().optional().describe("Limit to one course id from list_courses."),
  },
  handler: async (args, ctx) => {
    const daysAhead = args.days_ahead ?? 14;
    const includeSubmitted = args.include_submitted ?? false;
    const includeOverdue = args.include_overdue ?? true;

    const bundle = await fetchCanvasBundle(ctx.getToken(), ctx.signal);
    const now = Date.now();
    const horizon = now + daysAhead * 86_400_000;

    const items = bundle.assignments
      .filter((a) => (args.course_id ? a.course_id === args.course_id : true))
      .filter((a) => includeSubmitted || !isSubmitted(a))
      .filter((a) => {
        if (!a.due_at) return false;
        const due = new Date(a.due_at).getTime();
        if (!Number.isFinite(due)) return false;
        if (due > horizon) return false;
        if (due < now) return includeOverdue && !isSubmitted(a);
        return true;
      })
      .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
      .map((a) => ({
        id: a.id,
        name: a.name,
        course_name: a.course_name,
        course_code: a.course_code,
        course_id: a.course_id,
        due_at: a.due_at,
        points_possible: a.points_possible,
        submitted: isSubmitted(a),
        overdue: !isSubmitted(a) && new Date(a.due_at!).getTime() < now,
        score: a.submission?.score ?? null,
        url: a.html_url,
      }));

    if (items.length === 0) {
      return reply(`Nothing matching was found in the next ${daysAhead} day(s).`, {
        assignments: items,
      });
    }

    const lines = items.map((a) => {
      const due = new Date(a.due_at!).toISOString();
      const flags = [a.overdue ? "OVERDUE" : null, a.submitted ? "turned in" : null]
        .filter(Boolean)
        .join(", ");
      const pts = a.points_possible === null ? "" : ` · ${a.points_possible} pts`;
      return `- ${a.name} (${a.course_code}) — due ${due}${pts}${flags ? ` · ${flags}` : ""}`;
    });

    return reply(`${items.length} assignment(s):\n${lines.join("\n")}`, { assignments: items });
  },
});
