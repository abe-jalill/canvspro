import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  CalendarDays,
  Bell,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  Timer,
  Calculator,
  BarChart3,
  Sparkles,
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
      { property: "og:image", content: "https://canvaspro.app/og-home.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Canvas Pro — a calmer, faster dashboard for your Canvas classes" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://canvaspro.app/og-home.png" },
      { name: "twitter:image:alt", content: "Canvas Pro — a calmer, faster dashboard for your Canvas classes" },
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
    icon: Bell,
    title: "Notifications you control",
    body: "Choose what you get notified about — new grades, announcements, or due dates — and pick when, from one day to one week ahead.",
  },
  {
    icon: Calculator,
    title: "Grade calculator",
    body: "Weighted categories, running totals, and a final-exam target score so you know exactly what you need.",
  },
  {
    icon: BarChart3,
    title: "Workload heatmap",
    body: "See your busy days at a glance and spot the weeks that need a head start.",
  },
  {
    icon: Sparkles,
    title: "And many more",
    body: "Announcements in one place, class nicknames, syllabus quick-view, grade trend arrows, .ICS export, dark/light mode, and a mobile-first layout.",
  },
];

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="w-full">
      <section className="flex min-h-[86svh] flex-col items-center justify-center px-4 text-center">
        <h1
          className="rise-in text-5xl font-semibold tracking-tight sm:text-7xl"
          style={{ animationDelay: "80ms" }}
        >
          CanvasPro
        </h1>
        <p
          className="rise-in mt-4 text-lg text-muted-foreground sm:text-2xl"
          style={{ animationDelay: "320ms" }}
        >
          Canvas, but better.
        </p>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("overview")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          aria-label="Scroll down to learn more"
          className="rise-in glass-inset glass-hover mt-14 inline-flex h-12 w-12 items-center justify-center rounded-full"
          style={{ animationDelay: "620ms" }}
        >
          <ChevronDown className="scroll-hint h-5 w-5" />
        </button>
      </section>

      <div
        id="overview"
        className="mx-auto w-full max-w-5xl px-4 pb-12 sm:pb-16"
        style={{ scrollMarginTop: "1rem" }}
      >
      <Reveal>
      <section className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Canvas Pro
        </p>
        <h2 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          A calmer, faster dashboard for your Canvas classes
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Canvas Pro connects to your school's Canvas account and pulls your
          classes, grades, assignments, and announcements into one customizable
          home screen — so you stop hunting through course pages.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Free dashboard tier. Cancel anytime.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Curious what we store?{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Read the privacy policy
          </Link>
          .
        </p>
      </section>
      </Reveal>


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
