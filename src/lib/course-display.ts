// Display-only rename mapping. API calls still use the real names/IDs.
const RENAME_RULES: Array<{ match: RegExp; name: string }> = [
  { match: /PHY\s*1154/i, name: "Physics" },
  { match: /HUM\s*1213/i, name: "Humanities" },
];

// User-defined nicknames, keyed by lowercased raw course name / code so that
// every existing display call site picks them up without an id.
let nicknameByText = new Map<string, string>();
let nicknameById = new Map<number, string>();

export interface NicknameLookupRow {
  canvas_course_id: number;
  raw_name?: string | null;
  raw_code?: string | null;
  custom_name: string;
}

export function setNicknameLookup(rows: NicknameLookupRow[]) {
  const byText = new Map<string, string>();
  const byId = new Map<number, string>();
  for (const r of rows) {
    const custom = r.custom_name?.trim();
    if (!custom) continue;
    byId.set(Number(r.canvas_course_id), custom);
    if (r.raw_name) byText.set(r.raw_name.trim().toLowerCase(), custom);
    if (r.raw_code) byText.set(r.raw_code.trim().toLowerCase(), custom);
  }
  nicknameByText = byText;
  nicknameById = byId;
}

export function nicknameLookupVersion() {
  return Array.from(nicknameById.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([id, n]) => `${id}:${n}`)
    .join("|");
}

export function nicknameForCourseId(id?: number | null) {
  if (id == null) return undefined;
  return nicknameById.get(Number(id));
}

function nicknameFor(name?: string | null, code?: string | null) {
  for (const h of [name, code]) {
    if (!h) continue;
    const hit = nicknameByText.get(h.trim().toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

export function displayCourseName(name?: string | null, code?: string | null) {
  const nick = nicknameFor(name, code);
  if (nick) return nick;
  const haystacks = [name ?? "", code ?? ""];
  for (const rule of RENAME_RULES) {
    if (haystacks.some((h) => rule.match.test(h))) return rule.name;
  }
  return name ?? code ?? "Course";
}

export function displayCourseCode(name?: string | null, code?: string | null) {
  const nick = nicknameFor(name, code);
  if (nick) return nick;
  const haystacks = [name ?? "", code ?? ""];
  for (const rule of RENAME_RULES) {
    if (haystacks.some((h) => rule.match.test(h))) return rule.name;
  }
  return code ?? "";
}
