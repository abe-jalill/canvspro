import { defineTool } from "@lovable.dev/mcp-js";
import { fetchCanvasBundle, reply } from "../canvas";

export default defineTool({
  name: "list_courses",
  title: "List courses and grades",
  description:
    "List the student's active Canvas courses with their current grade in each one. Use this to answer questions about classes, course names, or current grades/GPA.",
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async (_args, ctx) => {
    const bundle = await fetchCanvasBundle(ctx.getToken(), ctx.signal);
    const courses = bundle.courses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.course_code,
      current_score: c.current_score,
      current_grade: c.current_grade,
    }));

    if (courses.length === 0) {
      return reply("No active Canvas courses were found for this student.", { courses });
    }

    const lines = courses.map((c) => {
      const grade =
        c.current_score === null
          ? "no grade yet"
          : `${c.current_score}%${c.current_grade ? ` (${c.current_grade})` : ""}`;
      return `- ${c.name} [${c.code}] — ${grade}`;
    });

    return reply(`${courses.length} active course(s):\n${lines.join("\n")}`, { courses });
  },
});
