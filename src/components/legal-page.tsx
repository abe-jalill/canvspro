import { Link } from "@tanstack/react-router";
import { LEGAL_POLICY_VERSION } from "@/lib/legal-consent";

export function LegalPage({
  title,
  sections,
}: {
  title: string;
  sections: { title: string; paragraphs: string[] }[];
}) {
  return (
    <main className="min-h-svh px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Effective and last updated: {LEGAL_POLICY_VERSION}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
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
        {sections.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
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
