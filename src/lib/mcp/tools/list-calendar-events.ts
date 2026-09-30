import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchCanvasBundle, reply } from "../canvas";

export default defineTool({
  name: "list_calendar_events",
  title: "List calendar events",
  description:
    "List the student's upcoming Canvas calendar events such as lectures, labs, exams and meetings. Assignment due dates come from list_assignments instead.",
  annotations: { readOnlyHint: true, openWorldHint: true },
  inputSchema: {
    days_ahead: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe("How many days ahead to include. Default 14."),
  },
  handler: async (args, ctx) => {
    const daysAhead = args.days_ahead ?? 14;
    const bundle = await fetchCanvasBundle(ctx.getToken(), ctx.signal);
    const now = Date.now();
    const horizon = now + daysAhead * 86_400_000;

    const items = bundle.calendar
      .filter((e) => {
        if (!e.start_at) return false;
        const start = new Date(e.start_at).getTime();
        return Number.isFinite(start) && start >= now && start <= horizon;
      })
      .sort((a, b) => new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime())
      .map((e) => ({
        id: String(e.id),
        title: e.title,
        start_at: e.start_at,
        end_at: e.end_at,
        course: e.context_name ?? null,
        location: e.location_name ?? null,
      }));

    if (items.length === 0) {
      return reply(`No calendar events in the next ${daysAhead} day(s).`, { events: items });
    }

    const lines = items.map(
      (e) =>
        `- ${e.title}${e.course ? ` (${e.course})` : ""} — ${new Date(e.start_at!).toISOString()}${
          e.location ? ` · ${e.location}` : ""
        }`,
    );

    return reply(`${items.length} event(s):\n${lines.join("\n")}`, { events: items });
  },
});
