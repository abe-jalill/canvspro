/**
 * Quick add: one line typed the way you'd jot it down — "Read ch4 bio fri 30m",
 * "Lab report chem tomorrow 5pm 1h" — becomes a task with its class, due date
 * and estimate. The iPhone app ports these same rules.
 */

export interface QuickCourse {
  id: number;
  /** Words the class can be called by: its code ("BIO 201", "bio"), name, nickname. */
  names: string[];
}

export interface QuickAddResult {
  name: string;
  courseId: number | null;
  courseLabel: string | null;
  /** ISO time, or null for no due date. */
  dueAt: string | null;
  minutes: number | null;
}

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};
const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The ways a class can be named in a quick add: "BIO 201" → bio, bio201; "Cell Biology" → cellbiology, cell, biology. */
export function courseAliases(name: string, code: string, nickname?: string | null): string[] {
  const out = new Set<string>();
  for (const text of [code, name, nickname ?? ""]) {
    const n = norm(text);
    if (n.length >= 3) out.add(n);
    const letters = /^([a-z]{2,5})\s*\d/i.exec(text.trim())?.[1];
    if (letters) out.add(letters.toLowerCase());
    for (const word of text.split(/\s+/)) {
      const w = norm(word);
      if (
        w.length >= 4 &&
        !/^(intro|introduction|the|and|for|of|to|section|lecture|lab|course|general|principles|advanced|foundations|topics|special|seminar|honors|survey)$/.test(
          w,
        )
      )
        out.add(w);
    }
  }
  return [...out];
}

function at(base: Date, hours: number, minutes: number): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** Reads one quick-add line. `now` sets "today". */
export function parseQuickAdd(
  text: string,
  courses: QuickCourse[],
  now = Date.now(),
): QuickAddResult {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const used = new Set<number>();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  let day: Date | null = null;
  let time: { h: number; m: number } | null = null;
  let minutes: number | null = null;
  let courseId: number | null = null;
  let courseLabel: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    // Already read as part of the token before ("next fri", "2 hours").
    if (used.has(i)) continue;
    const raw = tokens[i];
    const t = raw.toLowerCase().replace(/[,.]$/, "");
    const nextTok = tokens[i + 1]?.toLowerCase();

    // Estimate: 30m, 45min, 1h, 1.5hr, 2 hours
    let m = /^(\d+(?:\.\d+)?)(m|min|mins|minutes|h|hr|hrs|hour|hours)$/.exec(t);
    if (
      !m &&
      /^\d+(?:\.\d+)?$/.test(t) &&
      nextTok &&
      /^(m|min|mins|minutes|h|hr|hrs|hour|hours)$/.test(nextTok)
    ) {
      m = [t + nextTok, t, nextTok] as unknown as RegExpExecArray;
      used.add(i + 1);
    }
    if (m && minutes == null) {
      const value = Number(m[1]);
      const mins = m[2].startsWith("h") ? value * 60 : value;
      if (mins > 0 && mins <= 600) {
        minutes = Math.round(mins);
        used.add(i);
        continue;
      }
    }

    // Day: today, tonight, tomorrow, a weekday, "next fri", 10/24, oct 24
    if (day == null) {
      if (t === "today" || t === "tonight") {
        day = today;
        if (t === "tonight" && !time) time = { h: 21, m: 0 };
        used.add(i);
        continue;
      }
      if (t === "tomorrow" || t === "tmr" || t === "tmrw" || t === "tom") {
        day = new Date(today);
        day.setDate(day.getDate() + 1);
        used.add(i);
        continue;
      }
      const isNext =
        t === "next" && nextTok != null && WEEKDAYS[nextTok.replace(/[,.]$/, "")] != null;
      const weekday = WEEKDAYS[isNext ? nextTok!.replace(/[,.]$/, "") : t];
      if (weekday != null) {
        day = new Date(today);
        let ahead = (weekday - today.getDay() + 7) % 7;
        if (isNext && ahead === 0) ahead = 7;
        day.setDate(day.getDate() + ahead);
        used.add(i);
        if (isNext) used.add(i + 1);
        continue;
      }
      const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
      if (slash) {
        day = new Date(today.getFullYear(), Number(slash[1]) - 1, Number(slash[2]));
        if (day < today) day.setFullYear(day.getFullYear() + 1);
        used.add(i);
        continue;
      }
      const month = MONTHS[t];
      if (month != null && nextTok && /^\d{1,2}(st|nd|rd|th)?$/.test(nextTok)) {
        day = new Date(today.getFullYear(), month, parseInt(nextTok, 10));
        if (day < today) day.setFullYear(day.getFullYear() + 1);
        used.add(i);
        used.add(i + 1);
        continue;
      }
    }

    // Time: 5pm, 5:30pm, 17:00, "at 5", noon, midnight
    if (time == null) {
      let tm = /^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)$/.exec(t);
      let skipAt = false;
      if (!tm && t === "at" && nextTok) {
        tm = /^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)?$/.exec(nextTok);
        skipAt = !!tm;
      }
      if (tm) {
        let h = Number(tm[1]);
        const min = Number(tm[2] ?? 0);
        const mer = tm[3];
        if (mer?.startsWith("p") && h < 12) h += 12;
        if (mer?.startsWith("a") && h === 12) h = 0;
        // "at 5" with no am/pm: school hours, so afternoon.
        if (!mer && h >= 1 && h <= 6) h += 12;
        if (h <= 23 && min <= 59) {
          time = { h, m: min };
          used.add(i);
          if (skipAt) used.add(i + 1);
          continue;
        }
      }
      const twentyFour = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t);
      if (twentyFour) {
        time = { h: Number(twentyFour[1]), m: Number(twentyFour[2]) };
        used.add(i);
        continue;
      }
      if (t === "noon") {
        time = { h: 12, m: 0 };
        used.add(i);
        continue;
      }
      if (t === "midnight") {
        time = { h: 23, m: 59 };
        used.add(i);
        continue;
      }
    }

    // Class: a word that names exactly one class.
    if (courseId == null) {
      const n = norm(t);
      if (n.length >= 3) {
        // A whole name ("bio"), or the start of one ("psych", "calc") when it's 4+ letters.
        let hits = courses.filter((c) => c.names.some((name) => name === n));
        if (hits.length === 0 && n.length >= 4) {
          hits = courses.filter((c) => c.names.some((name) => name.startsWith(n)));
        }
        if (hits.length === 1) {
          courseId = hits[0].id;
          courseLabel = hits[0].names[0] ?? null;
          used.add(i);
          continue;
        }
      }
    }
  }

  const words = tokens.filter((_, i) => !used.has(i));
  // "Due" left over from "due fri" isn't part of the name.
  while (words.length > 1 && /^(due|by|on|for)$/i.test(words[words.length - 1])) words.pop();
  const cleaned = words.filter(
    (w, i) => !(i > 0 && /^(due|by)$/i.test(w) && i === words.length - 1),
  );
  const name = cleaned.join(" ").trim();

  let dueAt: string | null = null;
  if (day || time) {
    const base = day ?? today;
    let when = time ? at(base, time.h, time.m) : at(base, 23, 59);
    // A time already past today, with no day given, means tomorrow.
    if (!day && when.getTime() < now) {
      when = new Date(when);
      when.setDate(when.getDate() + 1);
    }
    dueAt = when.toISOString();
  }

  return {
    name: name ? name.charAt(0).toUpperCase() + name.slice(1) : "",
    courseId,
    courseLabel,
    dueAt,
    minutes,
  };
}
