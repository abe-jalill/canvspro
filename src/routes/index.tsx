import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  ChevronDown,
  FileText,
  TrendingUp,
  Megaphone,
  ArrowRight,
  FolderOpen,
  Zap,
  Layers,
  Lock,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Trophy,
  Target,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import canvasLogoAsset from "@/assets/canvas-logo.png.asset.json";
import { Reveal } from "@/components/reveal";


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

const HERO_HIGHLIGHTS = [
  { icon: FolderOpen, title: "All your classes", body: "In one place" },
  { icon: Zap, title: "Real-time updates", body: "When it matters" },
  { icon: Layers, title: "Organized for you", body: "Not against you" },
  { icon: Lock, title: "Privacy first", body: "Your data stays yours" },
  { icon: RefreshCw, title: "Works with Canvas", body: "Seamless sync" },
];

const FLOATING_ITEMS = [
  {
    id: "logo",
    left: "45%",
    top: "1%",
    rotate: -6,
    cardClass: "glass-panel p-4 text-center w-auto",
    delay: "0.2s",
    duration: "6.5s",
    children: (
      <img
        src={canvasLogoAsset.url}
        alt="Canvas LMS logo"
        className="h-24 w-auto rounded-xl object-contain"
      />
    ),
  },
  {
    id: "streak",
    left: "20%",
    top: "3%",
    rotate: 8,
    cardClass: "glass-panel flex items-center gap-3 p-4 text-left w-56",
    delay: "0.5s",
    duration: "7.1s",
    children: (
      <>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vivid-amber/15 text-vivid-amber">
          <Flame className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">5-day streak</p>
          <p className="text-xs text-muted-foreground">Keep it going</p>
        </div>
      </>
    ),
  },
  {
    id: "focus",
    left: "63%",
    top: "5%",
    rotate: -4,
    cardClass: "glass-panel flex items-center gap-3 p-4 text-left w-60",
    delay: "0.8s",
    duration: "6.8s",
    children: (
      <>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vivid-violet/15 text-vivid-violet">
          <Target className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Focus mode</p>
          <p className="text-xs text-muted-foreground">3 due today</p>
        </div>
      </>
    ),
  },
  {
    id: "complete",
    left: "82%",
    top: "20%",
    rotate: -7,
    cardClass: "glass-panel flex items-center gap-3 p-4 text-left w-52",
    delay: "2.0s",
    duration: "7.3s",
    children: (
      <>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vivid-emerald/15 text-vivid-emerald">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">12 done</p>
          <p className="text-xs text-muted-foreground">This week</p>
        </div>
      </>
    ),
  },
  {
    id: "graded",
    left: "2%",
    top: "30%",
    rotate: 5,
    cardClass: "glass-panel p-4 text-left w-72",
    delay: "1.1s",
    duration: "7.2s",
    children: (
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-vivid-emerald/15 text-vivid-emerald">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Your assignment has been graded!</p>
          <p className="mt-1 text-xs text-muted-foreground">Biology Lab Report</p>
        </div>
        <span className="text-[10px] text-muted-foreground">2m ago</span>
      </div>
    ),
  },
  {
    id: "bell",
    left: "89%",
    top: "36%",
    rotate: -5,
    cardClass: "glass-panel flex h-20 w-20 items-center justify-center p-3",
    delay: "1.6s",
    duration: "7.0s",
    children: (
      <div className="relative">
        <Bell className="h-6 w-6 text-vivid-rose" />
        <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-vivid-rose text-xs font-semibold text-white">
          3
        </span>
      </div>
    ),
  },
  {
    id: "grade",
    left: "2%",
    top: "47%",
    rotate: -3,
    cardClass: "glass-panel p-4 text-left w-56",
    delay: "1.8s",
    duration: "6.8s",
    children: (
      <>
        <p className="text-xs text-muted-foreground">Current Grade</p>
        <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold">
          88.6%
          <span className="rounded-md bg-vivid-emerald/15 px-1.5 py-0.5 text-[11px] font-medium text-vivid-emerald">
            ↑ 4.2%
          </span>
        </p>
        <TrendingUp className="mt-2 h-10 w-full text-vivid-emerald" strokeWidth={1.5} />
      </>
    ),
  },
  {
    id: "calendar",
    left: "74%",
    top: "52%",
    rotate: 4,
    cardClass: "glass-panel p-4 text-left w-64",
    delay: "0.7s",
    duration: "6.2s",
    children: (
      <>
        <p className="text-sm font-semibold">Calendar</p>
        <p className="text-xs text-muted-foreground">This week</p>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
          {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={
                n === 7
                  ? "rounded-full bg-vivid-sky py-0.5 font-semibold text-white"
                  : "py-0.5 text-foreground/70"
              }
            >
              {n}
            </span>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "assignment",
    left: "3%",
    top: "63%",
    rotate: 4,
    cardClass: "glass-panel p-4 text-left w-72",
    delay: "2.4s",
    duration: "7.5s",
    children: (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-vivid-sky/15 text-vivid-sky">
          <CalendarDays className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-vivid-sky">Upcoming Assignment</p>
          <p className="truncate text-sm font-semibold">Research Paper Draft</p>
          <p className="text-xs text-muted-foreground">English 101</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Due in</p>
          <p className="text-xs font-semibold text-vivid-sky">2 days</p>
        </div>
      </div>
    ),
  },
  {
    id: "announcement",
    left: "68%",
    top: "61%",
    rotate: 2,
    cardClass: "glass-panel p-4 text-left w-80",
    delay: "2.5s",
    duration: "7.8s",
    children: (
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-vivid-amber/15 text-vivid-amber">
          <Megaphone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-vivid-amber">New Announcement</p>
          <p className="truncate text-sm font-semibold">Class canceled Friday</p>
          <p className="text-xs text-muted-foreground">Calculus II</p>
        </div>
        <span className="text-[10px] text-muted-foreground">1h ago</span>
      </div>
    ),
  },
];

function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      setIsChecking(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
      setIsChecking(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (isChecking) return null;

  return (
    <div className="w-full">
      <section className="relative flex min-h-[92svh] flex-col items-center justify-center overflow-hidden px-4 text-center">
        {/* Floating decorative cards (desktop only, purely decorative) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 hidden h-[80%] lg:block">
          {FLOATING_ITEMS.map((item) => (
            <div
              key={item.id}
              className="absolute"
              style={{
                left: item.left,
                top: item.top,
                transform: `rotate(${item.rotate}deg)`,
              }}
            >
              <div
                className={`float-soft ${item.cardClass}`}
                style={{
                  animationDelay: item.delay,
                  animationDuration: item.duration,
                }}
              >
                {item.children}
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
          <h1
            className="rise-in text-5xl font-semibold tracking-tight sm:text-7xl"
            style={{ animationDelay: "80ms" }}
          >
            Hey! Welcome to{" "}
            <span className="bg-gradient-to-r from-brand to-brand-strong bg-clip-text text-transparent">
              CanvasPro.
            </span>
          </h1>
          <p
            className="rise-in mt-4 max-w-2xl text-lg text-muted-foreground sm:text-2xl"
            style={{ animationDelay: "320ms" }}
          >
            Your Canvas experience, finally built around you.
          </p>

          <div
            className="rise-in mt-8 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "440ms" }}
          >
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="glass-hover inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-strong px-7 text-sm font-semibold text-white"
              >
                Go to my dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="glass-hover inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-strong px-7 text-sm font-semibold text-white"
                >
                  Get started — $2.99/month <ArrowRight className="h-4 w-4" />
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

          <p
            className="rise-in mt-5 text-sm text-muted-foreground"
            style={{ animationDelay: "520ms" }}
          >
            Free dashboard tier. Cancel anytime. Or save with{" "}
            <Link to="/pricing" className="underline underline-offset-4 hover:text-foreground">
              $24.99/year — about 2 months free
            </Link>
            .
          </p>
          <p
            className="rise-in mt-1 text-sm text-muted-foreground"
            style={{ animationDelay: "560ms" }}
          >
            Curious what we store?{" "}
            <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Read the privacy policy
            </Link>
            .
          </p>

          <button
            type="button"
            onClick={() =>
              document
                .getElementById("overview")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            aria-label="Scroll down to learn more"
            className="rise-in glass-inset glass-hover mt-12 inline-flex h-12 w-12 items-center justify-center rounded-full"
            style={{ animationDelay: "620ms" }}
          >
            <ChevronDown className="scroll-hint h-5 w-5" />
          </button>
        </div>

        <ul className="relative z-10 mt-14 grid w-full max-w-5xl grid-cols-2 gap-4 text-left sm:grid-cols-3 lg:grid-cols-5">
          {HERO_HIGHLIGHTS.map((h) => (
            <li key={h.title} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <h.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{h.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{h.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div
        id="overview"
        className="mx-auto w-full max-w-5xl px-4 pb-12 sm:pb-16"
        style={{ scrollMarginTop: "1rem" }}
      >



      <Reveal delay={60}>
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
      </Reveal>

      <Reveal delay={60}>
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
      </Reveal>

      <Reveal delay={60}>
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
      </Reveal>
      </div>
    </div>
  );


}
