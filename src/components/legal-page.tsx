import { Link } from "@tanstack/react-router";
import { LEGAL_POLICY_VERSION } from "@/lib/legal-consent";

export interface LegalTable {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: LegalTable;
}

export interface LegalHighlight {
  title: string;
  body: string;
}

function sectionId(title: string) {
  return title
    .replace(/^\d+\.\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LegalPage({
  title,
  sections,
  intro,
  highlights,
}: {
  title: string;
  sections: LegalSection[];
  intro?: string;
  highlights?: LegalHighlight[];
}) {
  return (
    <main className="min-h-svh px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Effective and last updated: {LEGAL_POLICY_VERSION}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {intro && <p className="mt-4 text-base leading-7 text-muted-foreground">{intro}</p>}
        <nav aria-label="Legal documents" className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link to="/terms" className="underline underline-offset-4">
            Terms of Use
          </Link>
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          <a href="mailto:support@canvaspro.app" className="underline underline-offset-4">
            Contact support
          </a>
        </nav>

        {highlights && highlights.length > 0 && (
          <section
            aria-labelledby="legal-summary"
            className="mt-8 rounded-2xl border border-border/40 bg-muted/30 p-5 sm:p-6"
          >
            <h2 id="legal-summary" className="text-base font-semibold tracking-tight">
              The short version
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {highlights.map((item) => (
                <div key={item.title}>
                  <dt className="text-sm font-medium">{item.title}</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              This summary is a convenience. The full policy below is what applies.
            </p>
          </section>
        )}

        {sections.length > 4 && (
          <nav aria-label="On this page" className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              On this page
            </h2>
            <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {sections.map((section) => (
                <li key={section.title}>
                  <a
                    href={`#${sectionId(section.title)}`}
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {sections.map((section) => (
          <section key={section.title} id={sectionId(section.title)} className="mt-10 scroll-mt-6">
            <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul className="list-disc space-y-1.5 pl-5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {section.table && (
                <div className="overflow-x-auto rounded-xl border border-border/40">
                  <table className="w-full min-w-[34rem] border-collapse text-left text-sm leading-6">
                    {section.table.caption && (
                      <caption className="sr-only">{section.table.caption}</caption>
                    )}
                    <thead className="bg-muted/40 text-foreground">
                      <tr>
                        {section.table.headers.map((header) => (
                          <th key={header} scope="col" className="px-4 py-2.5 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row) => (
                        <tr key={row[0]} className="border-t border-border/40 align-top">
                          {row.map((cell, index) => (
                            <td
                              key={`${row[0]}-${index}`}
                              className={index === 0 ? "px-4 py-3 font-medium text-foreground" : "px-4 py-3"}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ))}
        <div className="mt-12 border-t border-border/30 pt-6">
          <Link to="/" className="text-sm font-medium underline underline-offset-4">
            Back to CanvasPro
          </Link>
        </div>
      </article>
    </main>
  );
}
