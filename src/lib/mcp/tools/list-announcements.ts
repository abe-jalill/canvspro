import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchCanvasBundle, reply, stripHtml } from "../canvas";

export default defineTool({
  name: "list_announcements",
  title: "List course announcements",
  description:
    "List recent Canvas announcements posted by the student's instructors, newest first. Use this to summarise class news, schedule changes or instructor instructions.",
  annotations: { readOnlyHint: true, openWorldHint: true },
  inputSchema: {
    days_back: z
      .number()
      .int()
      .min(1)
      .max(90)
      .optional()
      .describe("How many days back to include. Default 14."),
    course_id: z.number().int().optional().describe("Limit to one course id from list_courses."),
  },
  handler: async (args, ctx) => {
    const daysBack = args.days_back ?? 14;
    const bundle = await fetchCanvasBundle(ctx.getToken(), ctx.signal);
    const cutoff = Date.now() - daysBack * 86_400_000;

    const courseName = args.course_id
      ? bundle.courses.find((c) => c.id === args.course_id)?.name
      : undefined;

    const items = bundle.announcements
      .filter((a) => (courseName ? a.course_name === courseName : true))
      .filter((a) => {
        const posted = new Date(a.posted_at).getTime();
        return Number.isFinite(posted) && posted >= cutoff;
      })
      .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())
      .map((a) => ({
        id: a.id,
        title: a.title,
        course_name: a.course_name,
        course_code: a.course_code,
        posted_at: a.posted_at,
        body: stripHtml(a.message ?? ""),
        url: a.html_url,
      }));

    if (items.length === 0) {
      return reply(`No announcements in the last ${daysBack} day(s).`, { announcements: items });
    }

    const lines = items.map(
      (a) =>
        `- [${a.course_code}] ${a.title} (${new Date(a.posted_at).toISOString()})\n  ${a.body}`,
    );

    return reply(`${items.length} announcement(s):\n${lines.join("\n")}`, {
      announcements: items,
    });
  },
});
