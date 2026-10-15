import { Link, useRouterState } from "@tanstack/react-router";
import { LEGAL_POLICY_VERSION, LEGAL_TEXT_UPDATED } from "@/lib/legal-consent";
import { PublicPage, PublicPageHeader } from "@/components/public-page";

const DOCUMENTS = [
  { to: "/terms", label: "Terms of Use" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/support", label: "Support" },
] as const;

export function LegalPage({
  title,
  sections,
}: {
  title: string;
  sections: { title: string; paragraphs: string[] }[];
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
        <nav aria-label="Legal documents" className="hp-doc-nav">
          {DOCUMENTS.map((doc) => (
            <Link key={doc.to} to={doc.to} aria-current={pathname === doc.to ? "page" : undefined}>
              {doc.label}
            </Link>
          ))}
        </nav>
      </PublicPageHeader>
      <div className="hp-prose">
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <div>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PublicPage>
  );
}
