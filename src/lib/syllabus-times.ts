import { htmlToText } from "./html-text.ts";
import type { ClassDay } from "./class-schedule.ts";

/**
 * Class meeting times found in a Canvas syllabus ("MWF 10:00–10:50 AM",
 * "Tuesdays and Thursdays, 2:30 to 3:45 pm, Room 204"). Office hours, exams
 * and deadlines are left out. Everything found is a suggestion the student
 * can edit or delete in My classes.
 */
export interface FoundMeeting {
  days: ClassDay[];
  startMinutes: number;
  endMinutes: number;
  location: string;
  kind: "Lecture" | "Lab" | "Discussion";
}

const SKIP =
  /office\s*hours?|\bexams?\b|\bfinal\b|\bmidterm|\bquiz|\bdue\b|deadline|\bhomework|drop\s+date|withdraw|\bholiday|no\s+class|\bbreak\b|tutoring|help\s+session|review\s+session/i;

const MERIDIEM = String.raw`(a\.?\s?m\.?|p\.?\s?m\.?|noon)`;
const TIME_RANGE = new RegExp(
  String.raw`\b(\d{1,2})(?:[:.](\d{2}))?\s*${MERIDIEM}?\s*(?:-|–|—|to|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*${MERIDIEM}?`,
  "i",
);

const DAY_WORDS: [RegExp, ClassDay][] = [
  [/\bmon(day)?s?\b/i, "M"],
  [/\btue(s|sday)?s?\b/i, "T"],
  [/\bwed(nesday)?s?\b/i, "W"],
  [/\bthu(r|rs|rsday)?s?\b/i, "R"],
  [/\bfri(day)?s?\b/i, "F"],
];

/** "MWF", "TR", "TTh", "Tu/Th", "M/W", "M W F", "MTWRF". Case matters: these are capitals. */
const COMPACT =
  /(?:^|[^A-Za-z])((?:M|Tu|TU|Th|TH|T|W|R|F)(?:\s?[/,&]?\s?(?:M|Tu|TU|Th|TH|T|W|R|F)){0,4})(?=$|[^A-Za-z])/g;

function parseCompact(token: string): ClassDay[] {
  const out: ClassDay[] = [];
  let i = 0;
  while (i < token.length) {
    const two = token.slice(i, i + 2);
    if (two === "Th" || two === "TH") {
      out.push("R");
      i += 2;
    } else if (two === "Tu" || two === "TU") {
      out.push("T");
      i += 2;
    } else if ("MTWRF".includes(token[i])) {
      out.push(token[i] as ClassDay);
      i += 1;
    } else {
      i += 1;
    }
  }
  return out;
}

function findDays(before: string, after: string): ClassDay[] {
  const text = `${before} ${after}`;
  const words = DAY_WORDS.filter(([re]) => re.test(text)).map(([, d]) => d);
  if (words.length > 0) return words;
  // Letters only right before the time (or right after it), so a stray "T" or
  // "M" elsewhere in a sentence isn't read as a day.
  const near = before.slice(-24);
  const last = [...near.matchAll(COMPACT)].map((m) => m[1]).pop();
  if (last) {
    const days = parseCompact(last);
    // One letter counts only when it sits right against the time ("W 3:00-5:50").
    if (days.length >= 2 || (days.length === 1 && near.trimEnd().endsWith(last))) return days;
  }
  const next = [...after.slice(0, 16).matchAll(COMPACT)].map((m) => m[1])[0];
  if (next && parseCompact(next).length >= 2) return parseCompact(next);
  return [];
}

function toMinutes(hour: number, minute: number, meridiem: string | undefined): number | null {
  if (minute > 59 || hour > 23) return null;
  const m = meridiem?.toLowerCase().replace(/[.\s]/g, "");
  if (m === "noon") return 12 * 60 + minute;
  if (m === "am") return (hour % 12) * 60 + minute;
  if (m === "pm") return ((hour % 12) + 12) * 60 + minute;
  return hour * 60 + minute;
}

/** Reads one "10:00 – 11:15 AM" style range, filling in the missing AM/PM. */
function readRange(match: RegExpMatchArray): { start: number; end: number } | null {
  const [, h1, m1, mer1, h2, m2, mer2] = match;
  // A bare "1-2" is a page or chapter, not a time.
  if (!m1 && !m2 && !mer1 && !mer2) return null;
  const sh = Number(h1);
  const eh = Number(h2);
  const sm = Number(m1 ?? 0);
  const em = Number(m2 ?? 0);
  let end = toMinutes(eh, em, mer2 ?? mer1);
  if (end == null) return null;
  let start: number | null;
  if (mer1) {
    start = toMinutes(sh, sm, mer1);
  } else if (mer2) {
    // "11:00-12:15 PM": the start is in the morning if PM would put it after the end.
    start = toMinutes(sh, sm, mer2);
    if (start != null && start >= end) start -= 12 * 60;
  } else {
    // No AM/PM at all: school hours. 7–11 is morning, 12–6 afternoon.
    const guess = (h: number) => (h >= 13 ? h : h >= 7 && h <= 11 ? h : h === 12 ? 12 : h + 12);
    start = guess(sh) * 60 + sm;
    end = guess(eh) * 60 + em;
    if (end <= start && end + 12 * 60 > start) end += 12 * 60;
  }
  if (start == null || start < 0) return null;
  const length = end - start;
  if (length < 20 || length > 5 * 60) return null;
  if (start < 6 * 60 || end > 23 * 60) return null;
  return { start, end };
}

const LOCATION =
  /\b(room|rm\.?|location|classroom|where|bldg\.?|building)\b\s*[:#-]?\s*([A-Z0-9][A-Za-z0-9 .#\-/]{1,40}?)(?=$|[,;|()]|\s{2}|\s(?:on|from|at|meets|time|days?)\b)/i;

/** Every class meeting the syllabus states, without duplicates. */
export function findClassTimes(syllabusHtml: string | null | undefined): FoundMeeting[] {
  if (!syllabusHtml) return [];
  const lines = htmlToText(syllabusHtml)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const found: FoundMeeting[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    if (SKIP.test(line)) return;
    const match = line.match(TIME_RANGE);
    if (!match || match.index == null) return;
    const range = readRange(match);
    if (!range) return;
    const before = line.slice(0, match.index);
    const after = line.slice(match.index + match[0].length);
    let days = findDays(before, after);
    // "Class meetings: Tuesdays and Thursdays" on one line, the time on the next.
    if (days.length === 0 && index > 0 && !SKIP.test(lines[index - 1])) {
      days = findDays(lines[index - 1], "");
    }
    if (days.length === 0) return;
    const unique = [...new Set(days)].sort((a, b) => "MTWRF".indexOf(a) - "MTWRF".indexOf(b));
    const key = `${unique.join("")}-${range.start}-${range.end}`;
    if (seen.has(key)) return;
    seen.add(key);
    const context = `${lines[index - 1] ?? ""} ${line} ${lines[index + 1] ?? ""}`;
    const place = line.match(LOCATION) ?? context.match(LOCATION);
    found.push({
      days: unique,
      startMinutes: range.start,
      endMinutes: range.end,
      location: place
        ? /^(room|rm)/i.test(place[1])
          ? `Room ${place[2].trim()}`
          : place[2].trim()
        : "",
      kind: /\blab(oratory)?\b/i.test(line)
        ? "Lab"
        : /discussion|recitation/i.test(line)
          ? "Discussion"
          : "Lecture",
    });
  });
  // A syllabus that lists a dozen times is a schedule of something else.
  return found.length > 4 ? [] : found;
}
