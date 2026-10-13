// Convert Canvas HTML snippets into clean plain text (entities decoded).

const NAMED: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquo: "\u2018",
  rsquo: "\u2019",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  bull: "\u2022",
  middot: "\u00B7",
  deg: "\u00B0",
  eacute: "\u00E9",
};

export function decodeEntities(input: string): string {
  return input.replace(
    /&(#(?:[xX][0-9a-fA-F]+|[0-9]+)|[a-zA-Z][a-zA-Z0-9]*);/g,
    (m, ent: string) => {
      if (ent.startsWith("#")) {
        const hex = ent[1].toLowerCase() === "x";
        const cp = parseInt(ent.slice(hex ? 2 : 1), hex ? 16 : 10);
        // Invalid Unicode references must not crash a whole description preview.
        if (!Number.isFinite(cp) || cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
          return "\uFFFD";
        }
        return String.fromCodePoint(cp);
      }
      const hit = NAMED[ent.toLowerCase()];
      return hit ?? m;
    },
  );
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
