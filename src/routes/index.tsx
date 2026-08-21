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

/* Faint blue background decorations (dot grids, plus marks, rings, watermarks) */
function DotGrid({ cols = 5, rows = 4 }: { cols?: number; rows?: number }) {
  return (
    <div
      className="grid gap-[10px]"
      style={{ gridTemplateColumns: `repeat(${cols}, 4px)` }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-brand/25" />
      ))}
    </div>
  );
}

const DECOR = [
  { id: "dots-top", left: "55%", top: "9%", node: <DotGrid cols={6} rows={4} /> },
  {
    id: "ring",
    left: "50%",
    top: "23%",
    node: <span className="block h-5 w-5 rounded-full border border-brand/25" />,
  },
  {
    id: "plus-left",
    left: "24%",
    top: "29%",
    node: (
      <span className="relative block h-4 w-4">
        <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-brand/25" />
        <span className="absolute top-1/2 left-0 h-px w-4 -translate-y-1/2 bg-brand/25" />
      </span>
    ),
  },
  { id: "dots-right", left: "82%", top: "45%", node: <DotGrid cols={4} rows={4} /> },
  {
    id: "plus-mid",
    left: "32%",
    top: "64%",
    node: (
      <span className="relative block h-4 w-4">
        <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-brand/25" />
        <span className="absolute top-1/2 left-0 h-px w-4 -translate-y-1/2 bg-brand/25" />
      </span>
    ),
  },
  { id: "dots-lower", left: "27%", top: "76%", node: <DotGrid cols={5} rows={4} /> },
  {
    id: "square-top",
    left: "68%",
    top: "13%",
    node: (
      <span className="block h-14 w-14 rotate-12 rounded-2xl border border-brand/15 bg-brand/[0.06]" />
    ),
  },
  {
    id: "watermark-left",
    left: "2%",
    top: "76%",
    node: (
      <img
        src={canvasLogoAsset.url}
        alt=""
        className="h-32 w-32 opacity-[0.08] [filter:grayscale(1)_sepia(1)_hue-rotate(185deg)_saturate(4)]"
      />
    ),
  },
  {
    id: "watermark-right",
    right: "1%",
    top: "70%",
    node: (
      <img
        src={canvasLogoAsset.url}
        alt=""
        className="h-44 w-44 opacity-[0.08] [filter:grayscale(1)_sepia(1)_hue-rotate(185deg)_saturate(4)]"
      />
    ),
  },
];

const FLOATING_ITEMS = [
  {
    id: "graded",
    left: "4%",
    top: "15%",
    rotate: -4,
    cardClass: "glass-panel p-4 text-left w-80",
    children: (
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-vivid-sky/15 text-vivid-sky">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Your assignment has been graded!</p>
          <p className="mt-1 text-xs text-muted-foreground">Biology Lab Report</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] text-muted-foreground">2m ago</span>
          <span className="rounded-md bg-vivid-emerald/15 px-1.5 py-0.5 text-[11px] font-medium text-vivid-emerald">
            92 / 100
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "logo",
    left: "33%",
    top: "13%",
    rotate: 0,
    cardClass: "glass-panel flex h-20 w-20 items-center justify-center p-3",
    children: (
      <img
        src={canvasLogoAsset.url}
        alt="Canvas LMS logo"
        className="h-10 w-10 object-contain"
      />
    ),
  },
  {
    id: "calendar",
    right: "7%",
    top: "15%",
    rotate: 0,
    cardClass: "glass-panel p-4 text-left w-60",
    children: (
      <>
        <p className="text-sm font-semibold">Calendar</p>
        <p className="text-xs text-muted-foreground">May 2024</p>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
          {[28, 29, 30].map((n) => (
            <span key={`p${n}`} className="py-0.5 text-muted-foreground/50">
              {n}
            </span>
          ))}
          {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
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
    id: "grade",
    left: "8%",
    top: "38%",
    rotate: -2,
    cardClass: "glass-panel p-4 text-left w-52",
    children: (
      <>
        <p className="text-xs text-muted-foreground">Current Grade</p>
        <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold">
          88.6%
          <span className="rounded-md bg-vivid-emerald/15 px-1.5 py-0.5 text-[11px] font-medium text-vivid-emerald">
            ↑ 4.2%
          </span>
        </p>
        <TrendingUp className="mt-2 h-10 w-full text-vivid-sky" strokeWidth={1.5} />
      </>
    ),
  },
  {
    id: "bell",
    right: "4%",
    top: "48%",
    rotate: 0,
    cardClass: "glass-panel flex h-20 w-20 items-center justify-center p-3",
    children: (
      <div className="relative">
        <Bell className="h-6 w-6 text-vivid-sky" />
        <span className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-vivid-rose text-xs font-semibold text-white">
          3
        </span>
      </div>
    ),
  },
  {
    id: "assignment",
    left: "5%",
    top: "59%",
    rotate: 2,
    cardClass: "glass-panel p-4 text-left w-80",
    children: (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-vivid-violet/15 text-vivid-violet">
          <CalendarDays className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Upcoming Assignment</p>
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
    right: "11%",
    top: "59%",
    rotate: -2,
    cardClass: "glass-panel p-4 text-left w-80",
    children: (
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-vivid-sky/15 text-vivid-sky">
          <Megaphone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-vivid-sky">New Announcement</p>
          <p className="truncate text-sm font-semibold">Class canceled Friday</p>
          <p className="text-xs text-muted-foreground">Calculus II</p>
        </div>
        <span className="text-[10px] text-muted-foreground">1h ago</span>
      </div>
    ),
  },
  {
    id: "book",
    left: "17%",
    top: "80%",
    rotate: 0,
    cardClass: "glass-panel flex h-20 w-20 items-center justify-center p-3",
    children: <BookOpen className="h-7 w-7 text-vivid-sky" />,
  },
  {
    id: "done",
    left: "76%",
    top: "80%",
    rotate: 0,
    cardClass: "glass-panel flex h-20 w-20 items-center justify-center p-3",
    children: <CheckCircle2 className="h-7 w-7 text-vivid-emerald" />,
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
        {/* Faint blue background decorations */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
          {DECOR.map((d) => (
            <div
              key={d.id}
              className="absolute"
              style={{
                left: "left" in d ? d.left : undefined,
                right: "right" in d ? d.right : undefined,
                top: d.top,
              }}
            >
              {d.node}
            </div>
          ))}
        </div>

        {/* Floating decorative cards (desktop only, purely decorative) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 hidden h-[80%] lg:block">

          {FLOATING_ITEMS.map((item) => (
            <div
              key={item.id}
              className="absolute"
              style={{
                left: "left" in item ? item.left : undefined,
                right: "right" in item ? item.right : undefined,
                top: item.top,
                transform: `rotate(${item.rotate}deg)`,
              }}
            >
              <div className={item.cardClass}>
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
