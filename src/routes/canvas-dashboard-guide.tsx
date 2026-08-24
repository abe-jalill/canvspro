import { createFileRoute, Link } from "@tanstack/react-router";

export const TITLE = "How to Customize Your Canvas Dashboard (Student Guide)";
export const DESCRIPTION =
  "Show grades on Canvas dashboard cards, rename or color-code courses, and remove old classes from your dashboard — step by step, for students.";

export const Route = createFileRoute("/canvas-dashboard-guide")({
  head: () => ({
    meta: [
      { title: "How to Customize Your Canvas Dashboard — Canvas Pro" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://canvaspro.app/canvas-dashboard-guide" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/canvas-dashboard-guide" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          mainEntityOfPage: "https://canvaspro.app/canvas-dashboard-guide",
        }),
      },
    ],
  }),
  component: GuidePage,
});

function Section({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="glass-panel p-6">
      <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="ml-4 list-decimal space-y-2">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  );
}

function GuidePage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Guide
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{TITLE}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          The Canvas dashboard hides most of what you need. Here is how to make it
          show grades, use names you recognize, and drop the classes you finished.
        </p>
      </header>

      <nav className="glass-inset mt-8 p-4 text-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
          On this page
        </p>
        <ul className="space-y-1 text-muted-foreground">
          <li>
            <a href="#grades" className="underline underline-offset-4 hover:text-foreground">
              Show grades on dashboard cards
            </a>
          </li>
          <li>
            <a href="#nicknames" className="underline underline-offset-4 hover:text-foreground">
              Rename and color-code courses
            </a>
          </li>
          <li>
            <a href="#remove" className="underline underline-offset-4 hover:text-foreground">
              Remove classes from the dashboard
            </a>
          </li>
          <li>
            <a href="#views" className="underline underline-offset-4 hover:text-foreground">
              Switch dashboard views
            </a>
          </li>
          <li>
            <a href="#limits" className="underline underline-offset-4 hover:text-foreground">
              What you still can't change
            </a>
          </li>
        </ul>
      </nav>

      <div className="mt-8 space-y-6">
        <Section id="grades" heading="Show grades on Canvas dashboard cards">
          <p>
            Course cards can display your current score, but the option is off by
            default and lives on the card itself, not in settings.
          </p>
          <Steps
            items={[
              "Open your Canvas dashboard (the home icon in the global navigation).",
              "Find the course card you want and click the three-dot menu in its top-right corner.",
              "Check the box next to the grades option, then click Apply.",
              "Repeat for each course card — the setting is per course, not global.",
            ]}
          />
          <p>
            If you don't see the option, your instructor has hidden totals for
            that course, or grades are muted while grading is in progress. No
            dashboard setting overrides that.
          </p>
        </Section>

        <Section id="nicknames" heading="Rename and color-code your courses">
          <p>
            Canvas shows the official course name, like "PHY1154-04 FA26". You can
            replace that with a nickname only you see.
          </p>
          <Steps
            items={[
              "Click the three-dot menu on the course card.",
              "Type a nickname in the Nickname field — for example, Physics.",
              "Pick a color from the swatches; that color carries into the calendar and syllabus views.",
              "Click Apply. The nickname is yours only — classmates and instructors still see the real name.",
            ]}
          />
        </Section>

        <Section id="remove" heading="Remove a class from your dashboard">
          <p>
            You cannot delete a course, but you can stop it from appearing as a
            card by unfavoriting it.
          </p>
          <Steps
            items={[
              "Go to Courses in the global navigation, then All Courses.",
              "Find the star next to each course — filled stars are the courses shown on your dashboard.",
              "Click the star to unfavorite a course and remove its card.",
              "Concluded or past-term courses drop off automatically once the term ends.",
            ]}
          />
          <p>
            If no course is starred, Canvas falls back to showing all active
            courses, so star the ones you want rather than unstarring everything.
          </p>
        </Section>

        <Section id="views" heading="Switch between Card, List, and Recent Activity">
          <p>
            The three-dot menu at the top right of the dashboard switches views.
            Card view is the grid of course cards. List view is a single to-do
            list of upcoming work across every class — usually the most useful of
            the three during a busy week. Recent Activity is a feed of
            announcements, grades, and discussion posts.
          </p>
        </Section>

        <Section id="limits" heading="What Canvas still won't let you change">
          <ul className="ml-4 list-disc space-y-2">
            <li>You cannot reorder course cards by dragging them into your own priority order.</li>
            <li>You cannot combine grades, upcoming assignments, and announcements onto a single screen.</li>
            <li>You cannot set your own due-date windows, like "only show me the next two days".</li>
            <li>You cannot get reminders on a schedule you choose.</li>
          </ul>
        </Section>
      </div>

      <section className="glass-panel-strong mt-10 flex flex-col items-start gap-4 p-6">
        <h2 className="text-xl font-semibold tracking-tight">
          Or skip the settings entirely
        </h2>
        <p className="text-sm text-muted-foreground">
          Canvas Pro reads the same Canvas data through your own access key and
          gives you a dashboard you actually arrange: drag widgets for grades,
          assignments, announcements, class calendar, and focus windows, hide the
          ones you don't need, rename every class once, and get reminders on your
          schedule. $2.99/month, cancel anytime.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="glass-hover inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            Try Canvas Pro
          </Link>
          <Link
            to="/canvas-grade-calculator"
            className="glass-inset glass-hover inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
          >
            Free grade calculator
          </Link>
        </div>
      </section>
    </article>
  );
}
