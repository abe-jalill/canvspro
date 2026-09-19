import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/calendar/$userId.$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { userId, token } = params;
        if (
          !/^[0-9a-f-]{36}$/i.test(userId ?? "") ||
          !/^[0-9a-f-]{36}$/i.test(token ?? "")
        ) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // The feed token lives in user_preferences; it authorizes this
        // public, unauthenticated calendar subscription.
        const prefRes = await supabaseAdmin
          .from("user_preferences")
          .select("value")
          .eq("user_id", userId)
          .eq("key", "ics-feed-token")
          .maybeSingle();
        const stored = (prefRes.data?.value as { token?: string } | null)?.token;
        if (
          !stored ||
          !constantTimeEquals(hash(stored), hash(token))
        ) {
          return new Response("Not found", { status: 404 });
        }

        const settingsRes = await supabaseAdmin
          .from("user_settings")
          .select("canvas_api_key")
          .eq("user_id", userId)
          .maybeSingle();
        const canvasKey = settingsRes.data?.canvas_api_key?.trim();
        if (!canvasKey) return calendarResponse([], "CanvasPro");

        const domain = process.env["CANVAS_DOMAIN"];
        if (!domain) {
          console.error("[ics-feed] CANVAS_DOMAIN is not configured");
          return calendarResponse([], "CanvasPro");
        }

        // Hidden-course preference, same semantics as the Canvas proxy.
        const hiddenRes = await supabaseAdmin
          .from("user_preferences")
          .select("value")
          .eq("user_id", userId)
          .eq("key", "hidden_course_ids")
          .maybeSingle();
        const excluded = new Set<number>();
        const hidden = hiddenRes.data?.value;
        if (Array.isArray(hidden)) {
          hidden
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n))
            .forEach((n) => excluded.add(n));
        }

        const canvasHeaders = {
          Authorization: `Bearer ${canvasKey}`,
          Accept: "application/json",
        };

        try {
          const coursesRes = await fetch(
            `https://${domain}/api/v1/courses?enrollment_state=active&per_page=100`,
            { headers: canvasHeaders },
          );
          if (!coursesRes.ok) return calendarResponse([], "CanvasPro");
          const courses = (await coursesRes.json()) as Array<{
            id: number;
            name: string;
            course_code: string;
            workflow_state?: string;
            access_restricted_by_date?: boolean;
          }>;
          const active = courses.filter(
            (c) =>
              !excluded.has(c.id) &&
              !c.access_restricted_by_date &&
              (!c.workflow_state || c.workflow_state === "available"),
          );

          const perCourse = await Promise.all(
            active.map(async (c) => {
              try {
                const res = await fetch(
                  `https://${domain}/api/v1/courses/${c.id}/assignments?per_page=100&order_by=due_at`,
                  { headers: canvasHeaders },
                );
                if (!res.ok) return [];
                const list = (await res.json()) as Array<{
                  id: number;
                  name: string;
                  due_at: string | null;
                  html_url?: string;
                }>;
                return list.map((a) => ({ ...a, course: c }));
              } catch {
                return [];
              }
            }),
          );

          // Keep a window around "now": recent past for reference, a term ahead.
          const now = Date.now();
          const windowStart = now - 30 * 24 * 60 * 60 * 1000;
          const windowEnd = now + 180 * 24 * 60 * 60 * 1000;
          const events = perCourse
            .flat()
            .filter((a) => a.due_at)
            .filter((a) => {
              const t = new Date(a.due_at as string).getTime();
              return t >= windowStart && t <= windowEnd;
            })
            .sort((a, b) =>
              (a.due_at ?? "").localeCompare(b.due_at ?? ""),
            );

          return calendarResponse(events, "CanvasPro Deadlines");
        } catch (err) {
          console.error("[ics-feed]", err instanceof Error ? err.message : err);
          return calendarResponse([], "CanvasPro");
        }
      },
    },
  },
});

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

function constantTimeEquals(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface FeedAssignment {
  id: number;
  name: string;
  due_at: string | null;
  html_url?: string;
  course: { id: number; name: string; course_code: string };
}

function icsEscape(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function icsDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function calendarResponse(assignments: FeedAssignment[], calName: string) {
  const stamp = icsDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Canvas Pro//Deadlines Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calName)}`,
    "X-WR-CALDESC:Assignment due dates synced from CanvasPro",
  ];
  for (const a of assignments) {
    const start = new Date(a.due_at as string);
    const end = new Date(start.getTime() + 30 * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:assignment-${a.id}@canvaspro`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(`${a.name} (${a.course.course_code})`)}`,
      `DESCRIPTION:${icsEscape("Due on Canvas.")}`,
      ...(a.html_url ? [`URL:${a.html_url}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="canvaspro.ics"',
      "Cache-Control": "no-store",
    },
  });
}
