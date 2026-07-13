// Display-only rename mapping. API calls still use the real names/IDs.
const RENAME_RULES: Array<{ match: RegExp; name: string }> = [
  { match: /PHY\s*1154/i, name: "Physics" },
  { match: /HUM\s*1213/i, name: "Humanities" },
];

export function displayCourseName(name?: string | null, code?: string | null) {
  const haystacks = [name ?? "", code ?? ""];
  for (const rule of RENAME_RULES) {
    if (haystacks.some((h) => rule.match.test(h))) return rule.name;
  }
  return name ?? code ?? "Course";
}

export function displayCourseCode(name?: string | null, code?: string | null) {
  const haystacks = [name ?? "", code ?? ""];
  for (const rule of RENAME_RULES) {
    if (haystacks.some((h) => rule.match.test(h))) return rule.name;
  }
  return code ?? "";
}
