import { Link, useRouterState } from "@tanstack/react-router";
import { LEGAL_POLICY_VERSION, LEGAL_TEXT_UPDATED } from "@/lib/legal-consent";
import { PublicPage, PublicPageHeader } from "@/components/public-page";

const DOCUMENTS = [
  { to: "/terms", label: "Terms of Use" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/support", label: "Support" },
] as const;

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

/** Terms, Privacy and Refunds, in the homepage's frame (components/public-page.tsx). */
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <PublicPage>
      <PublicPageHeader
        eyebrow={
          LEGAL_TEXT_UPDATED === LEGAL_POLICY_VERSION
            ? `Effective and last updated ${LEGAL_POLICY_VERSION}`
            : `Effective ${LEGAL_POLICY_VERSION} · Last updated ${LEGAL_TEXT_UPDATED}`
        }
        title={title}
      >
        {intro && <p>{intro}</p>}
        <nav aria-label="Legal documents" className="hp-doc-nav">
          {DOCUMENTS.map((doc) => (
            <Link key={doc.to} to={doc.to} aria-current={pathname === doc.to ? "page" : undefined}>
              {doc.label}
            </Link>
          ))}
        </nav>
      </PublicPageHeader>

      {highlights && highlights.length > 0 && (
        <section aria-labelledby="legal-summary" className="hp-section hp-card">
          <h2 id="legal-summary">The short version</h2>
          <dl className="hp-legal-summary">
            {highlights.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
          <p className="hp-muted hp-legal-note">
            This summary is a convenience. The full policy below is what applies.
          </p>
        </section>
      )}

      {sections.length > 4 && (
        <nav aria-label="On this page" className="hp-section hp-legal-toc">
          <p className="hp-eyebrow">On this page</p>
          <ol>
            {sections.map((section) => (
              <li key={section.title}>
                <a href={`#${sectionId(section.title)}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="hp-prose">
        {sections.map((section) => (
          <section key={section.title} id={sectionId(section.title)}>
            <h2>{section.title}</h2>
            <div>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul className="hp-legal-list">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {section.table && (
                <div className="hp-legal-table">
                  <table>
                    {section.table.caption && (
                      <caption className="sr-only">{section.table.caption}</caption>
                    )}
                    <thead>
                      <tr>
                        {section.table.headers.map((header) => (
                          <th key={header} scope="col">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, index) => (
                            <td key={`${row[0]}-${index}`}>{cell}</td>
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
      </div>
    </PublicPage>
  );
}
