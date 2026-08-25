import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  Download,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  Newspaper,
  Pencil,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Canvas Pro — A Better Canvas Dashboard for Students" },
      {
        name: "description",
        content:
          "Canvas Pro turns Canvas into one customizable dashboard: class calendar, live grades, upcoming assignments, announcements, and due-date reminders. $2.99/month.",
      },
      { property: "og:title", content: "Canvas Pro — A Better Canvas Dashboard for Students" },
      {
        property: "og:description",
        content:
          "One customizable dashboard for your Canvas classes: calendar, grades, assignments, announcements, and smart reminders.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://canvaspro.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Canvas Pro",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          url: "https://canvaspro.app/",
          description:
            "A customizable student dashboard for Canvas LMS with grades, assignments, announcements, and due-date reminders.",
          offers: {
            "@type": "Offer",
            price: "2.99",
            priceCurrency: "USD",
          },
        }),
      },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "A homepage you arrange",
    body: "Drag widgets for calendar, grades, assignments, announcements, focus, and workload into the order you actually use. Hide the rest.",
  },
  {
    icon: GraduationCap,
    title: "Live grades, no clicking",
    body: "Every class score in one list, with trend arrows when something changes.",
  },
  {
    icon: Calculator,
    title: "Grade calculator",
    body: "Weighted category calculator and a final-exam score estimator — no more spreadsheet math.",
  },
  {
    icon: ListChecks,
    title: "Assignments that stay sorted",
    body: "Grouped by class, sorted by due date, with countdowns and one-tap complete.",
  },
  {
    icon: CalendarDays,
    title: "Calendar and class schedule",
    body: "Your next seven days of due dates and events, plus your recurring weekly class times.",
  },
  {
    icon: Timer,
    title: "Focus windows",
    body: "See only what's due within a day, two days, three days, or the week.",
  },
  {
    icon: BarChart3,
    title: "Workload heatmap",
    body: "Spot busy weeks at a glance so you can plan ahead instead of cram.",
  },
  {
    icon: Newspaper,
    title: "Daily digest",
    body: "A quick summary of what changed since you last opened Canvas Pro.",
  },
  {
    icon: SlidersHorizontal,
    title: "Notifications you control",
    body: "Choose when and what you get notified about: due windows, new grades, and announcements.",
  },
  {
    icon: Pencil,
    title: "Friendly class names",
    body: "Rename PHY1154 to Physics and MATH2010 to Calc 2 everywhere the app shows your courses.",
  },
  {
    icon: BookOpen,
    title: "Syllabus links",
    body: "Open any course syllabus in a modal without leaving your dashboard.",
  },
  {
    icon: Download,
    title: ".ics calendar export",
    body: "Export assignment due dates to Apple Calendar, Google Calendar, or Outlook in one tap.",
  },
];

function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setIsLoggedIn(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <section className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          CANVASPRO
        </p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          A calmer, faster dashboard for your Canvas classes
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Canvas Pro connects to your school's Canvas account and pulls your
          classes, grades, assignments, and announcements into one customizable
          home screen — so you stop hunting through course pages.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {isLoggedIn ? (
            <Link
              to="/dashboard"
              className="glass-hover inline-flex min-h-12 items-center justify-center rounded-xl bg-foreground px-6 text-sm font-semibold text-background"
            >
              Go to my dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="glass-hover inline-flex min-h-12 items-center justify-center rounded-xl bg-foreground px-6 text-sm font-semibold text-background"
              >
                Get started — $2.99/month
              </Link>
              <Link
                to="/auth"
                className="glass-inset glass-hover inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-sm font-medium"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
        {!isLoggedIn && (
          <p className="mt-3 text-xs text-muted-foreground">
            Free dashboard tier. Cancel anytime.
          </p>
        )}
      </section>

      <section className="mt-16">
        <h2 className="px-1 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          What you get
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="glass-panel flex flex-col gap-3 p-5">
              <f.icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          {
            step: "1",
            title: "Create your account",
            body: "Email and password, or continue with Google or Apple.",
          },
          {
            step: "2",
            title: "Add your Canvas key",
            body: "Paste a personal access token from your own Canvas account. It is stored write-only and never shown back.",
          },
          {
            step: "3",
            title: "Name your classes",
            body: "Swap course codes for names you recognize, then arrange your widgets.",
          },
        ].map((s) => (
          <article key={s.step} className="glass-panel p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Step {s.step}
            </p>
            <h3 className="mt-2 text-base font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </article>
        ))}
      </section>

      <section className="glass-panel-strong mt-16 flex flex-col items-center gap-4 p-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Free tools while you're here
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          No account needed — figure out your grade, or fix the Canvas dashboard
          you already have.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/canvas-grade-calculator"
            className="glass-inset glass-hover inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
          >
            Canvas grade calculator
          </Link>
          <Link
            to="/canvas-dashboard-guide"
            className="glass-inset glass-hover inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
          >
            Customize your Canvas dashboard
          </Link>
          <Link
            to="/pricing"
            className="glass-inset glass-hover inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
          >
            See pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
