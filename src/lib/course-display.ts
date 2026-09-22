// Display-only rename mapping. API calls still use the real names/IDs.
const RENAME_RULES: Array<{ match: RegExp; name: string }> = [
  { match: /PHY\s*1154/i, name: "Physics" },
  { match: /HUM\s*1213/i, name: "Humanities" },
];

// User-defined nicknames, keyed by lowercased raw course name / code so that
// every existing display call site picks them up without an id.
let nicknameByText = new Map<string, string>();
let nicknameById = new Map<number, string>();
let nicknameRows: readonly NicknameLookupRow[] | undefined;

export interface NicknameLookupRow {
  canvas_course_id: number;
  raw_name?: string | null;
  raw_code?: string | null;
  custom_name: string;
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Loose key: strips punctuation/section suffixes so variants still match. */
function loose(s: string) {
  return norm(s)
    .split(/[:|(]/)[0]
    .replace(/[^a-z0-9]+/g, "");
}

export function setNicknameLookup(rows: readonly NicknameLookupRow[]) {
  if (nicknameRows === rows) return;
  nicknameRows = rows;
  const byText = new Map<string, string>();
  const byId = new Map<number, string>();
  for (const r of rows) {
    const custom = r.custom_name?.trim();
    if (!custom) continue;
    byId.set(Number(r.canvas_course_id), custom);
    for (const raw of [r.raw_name, r.raw_code]) {
      if (!raw) continue;
      byText.set(norm(raw), custom);
      const l = loose(raw);
      if (l && !byText.has(l)) byText.set(l, custom);
    }
  }
  nicknameByText = byText;
  nicknameById = byId;
}

/**
 * Automatically converts raw all-caps names from university systems (e.g.
 * "UNIVERSITY PHYSICS 1", "PHYSICS 1 LAB", "CE PERSPECTIVES") into clean,
 * readable Title Case while preserving short acronyms and Roman numerals.
 */
export function formatCleanTitle(str?: string | null): string {
  if (!str) return "";
  const trimmed = str.trim();
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");

  // If the text contains at least 3 letters and is completely uppercase
  if (letters.length >= 3 && letters === letters.toUpperCase()) {
    const acronyms = new Set([
      "CE",
      "CS",
      "IT",
      "AI",
      "EE",
      "ME",
      "BME",
      "ECE",
      "CIV",
      "CHM",
      "CHEM",
      "BIO",
      "ENG",
      "ENGR",
      "MATH",
      "PHY",
      "PHYS",
      "HUM",
      "HIST",
      "SOC",
      "PSY",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
      "X",
      "AP",
      "IB",
      "GPA",
      "USA",
      "UK",
    ]);
    const minorWords = new Set([
      "of",
      "and",
      "in",
      "to",
      "for",
      "with",
      "on",
      "at",
      "by",
      "from",
      "the",
      "a",
      "an",
    ]);

    return trimmed
      .split(/(\s+)/)
      .map((part, idx) => {
        if (/^\s+$/.test(part)) return part;
        const cleanToken = part.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (acronyms.has(cleanToken)) {
          return part.toUpperCase();
        }
        const lower = part.toLowerCase();
        if (idx > 0 && minorWords.has(lower)) {
          return lower;
        }
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join("");
  }

  return trimmed;
}

export function nicknameForCourseId(id?: number | null) {
  if (id == null) return undefined;
  return nicknameById.get(Number(id));
}

/** Prefer the stable Canvas course id, then fall back to raw name/code matching. */
export function displayCourseNameForCourse(
  id?: number | null,
  name?: string | null,
  code?: string | null,
) {
  const nick = nicknameForCourseId(id);
  if (nick) return formatCleanTitle(nick);
  return displayCourseName(name, code);
}

function nicknameFor(name?: string | null, code?: string | null) {
  for (const h of [name, code]) {
    if (!h) continue;
    const hit = nicknameByText.get(norm(h)) ?? nicknameByText.get(loose(h));
    if (hit) return hit;
  }
  return undefined;
}

export function displayCourseName(name?: string | null, code?: string | null) {
  const nick = nicknameFor(name, code);
  if (nick) return formatCleanTitle(nick);
  const haystacks = [name ?? "", code ?? ""];
  for (const rule of RENAME_RULES) {
    if (haystacks.some((h) => rule.match.test(h))) return rule.name;
  }
  return formatCleanTitle(name ?? code ?? "Course");
}

export function displayCourseCode(name?: string | null, code?: string | null) {
  const nick = nicknameFor(name, code);
  if (nick) return formatCleanTitle(nick);
  const haystacks = [name ?? "", code ?? ""];
  for (const rule of RENAME_RULES) {
    if (haystacks.some((h) => rule.match.test(h))) return rule.name;
  }
  return code ?? "";
}
