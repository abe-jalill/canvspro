import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  Lock,
  Megaphone,
  Moon,
  Newspaper,
  Pencil,
  RefreshCw,
  SlidersHorizontal,
  Timer,
  Layers,
  Zap,
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
  {
    icon: Moon,
    title: "Dark and light mode",
    body: "Switch between a pure-black OLED theme and a clean light look.",
  },
];

const STRIP = [
  { icon: FolderOpen, title: "All your classes", body: "In one place", tint: "text-blue-600 bg-blue-50" },
  { icon: Zap, title: "Real-time updates", body: "When it matters", tint: "text-emerald-600 bg-emerald-50" },
  { icon: Layers, title: "Organized for you", body: "Not against you", tint: "text-indigo-600 bg-indigo-50" },
  { icon: Lock, title: "Privacy first", body: "Your data stays yours", tint: "text-orange-600 bg-orange-50" },
  { icon: RefreshCw, title: "Works with Canvas", body: "Seamless sync", tint: "text-sky-600 bg-sky-50" },
];

const CARD = "rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_18px_40px_-24px_rgba(30,60,140,0.35)] backdrop-blur";

function GradedSticker() {
  return (
    <div className={`${CARD} sticker w-full max-w-[19rem] p-4`} style={{ animationDelay: "0s", animationDuration: "7s" }}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">
              Your assignment has been graded!
            </p>
            <span className="shrink-0 text-[11px] text-slate-400">2m ago</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-slate-500">Biology Lab Report</p>
            <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
              92 / 100
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GradeSticker() {
  return (
    <div className={`${CARD} sticker w-full max-w-[13rem] p-4`} style={{ animationDelay: "1.4s", animationDuration: "8.5s" }}>
      <p className="text-xs text-slate-500">Current Grade</p>
      <div className="mt-1 flex items-end gap-2">
        <p className="text-2xl font-bold tracking-tight text-slate-900">88.6%</p>
        <span className="mb-1 text-[11px] font-semibold text-emerald-600">↑ 4.2%</span>
      </div>
      <svg viewBox="0 0 120 34" className="mt-3 h-9 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M2 28 L20 24 L34 26 L48 16 L62 19 L76 10 L92 12 L118 4" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 28 L20 24 L34 26 L48 16 L62 19 L76 10 L92 12 L118 4 L118 34 L2 34 Z" fill="url(#spark)" />
      </svg>
    </div>
  );
}

function UpcomingSticker() {
  return (
    <div className={`${CARD} sticker w-full max-w-[21rem] p-4`} style={{ animationDelay: "0.8s", animationDuration: "9.5s" }}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <CalendarDays className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">Upcoming Assignment</p>
          <p className="truncate text-sm font-semibold text-slate-800">Research Paper Draft</p>
          <p className="text-xs text-slate-400">English 101</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-slate-400">Due in</p>
          <p className="text-sm font-semibold text-blue-600">2 days</p>
        </div>
      </div>
    </div>
  );
}

function CalendarSticker() {
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const cells = [28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  return (
    <div className={`${CARD} sticker w-full max-w-[14rem] p-4`} style={{ animationDelay: "2.1s", animationDuration: "8s" }}>
      <p className="text-sm font-semibold text-slate-800">Calendar</p>
      <p className="mt-2 text-[11px] text-slate-400">May 2024</p>
      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[10px] text-slate-400">
        {days.map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
        {cells.map((n, i) => (
          <span
            key={i}
            className={
              n === 7
                ? "mx-auto grid h-4 w-4 place-items-center rounded-full bg-blue-600 text-[10px] font-semibold text-white"
                : i < 3
                  ? "text-slate-300"
                  : "text-slate-500"
            }
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

function BellSticker() {
  return (
    <div className={`${CARD} sticker relative grid h-16 w-16 place-items-center`} style={{ animationDelay: "1.1s", animationDuration: "6.5s" }}>
      <Bell className="h-7 w-7 text-blue-600" />
      <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
        3
      </span>
    </div>
  );
}

function AnnouncementSticker() {
  return (
    <div className={`${CARD} sticker w-full max-w-[20rem] p-4`} style={{ animationDelay: "2.6s", animationDuration: "9s" }}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Megaphone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-slate-500">New Announcement</p>
            <span className="shrink-0 text-[11px] text-slate-400">1h ago</span>
          </div>
          <p className="truncate text-sm font-semibold text-slate-800">Class canceled Friday</p>
          <p className="text-xs text-slate-400">Calculus II</p>
        </div>
      </div>
    </div>
  );
}

function IconSticker({
  children,
  className,
  delay,
  duration,
}: {
  children: React.ReactNode;
  className?: string;
  delay: string;
  duration: string;
}) {
  return (
    <div
      className={`${CARD} sticker grid h-16 w-16 place-items-center ${className ?? ""}`}
      style={{ animationDelay: delay, animationDuration: duration }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Public marketing page is always light, regardless of saved preference.
    const root = document.documentElement;
    root.classList.add("light");
    root.classList.remove("dark");
  }, []);

  useEffect(() => {
    let active = true;
    // Only bounce to the dashboard when the stored session is actually valid.
    // A stale/expired token would otherwise send us to /dashboard, where the
    // auth gate immediately kicks the visitor to /auth.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return;
      const { data: userData, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !userData.user) {
        await supabase.auth.signOut();
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);


  return (
    <div className="relative overflow-hidden">
      {/* Nav */}
      <header className="mx-auto w-full max-w-6xl px-4 pt-4 sm:pt-6">
        <nav className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-[0_10px_30px_-24px_rgba(30,60,140,0.4)] backdrop-blur-md sm:px-6">
          <Link to="/" className="press flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-base font-bold text-white">
              C
            </span>
            <span className="whitespace-nowrap text-xs font-extrabold tracking-[0.12em] text-blue-700 sm:text-sm">
              CANVAS PRO
            </span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="press hover:text-slate-900">Features</a>
            <Link to="/privacy" className="press hover:text-slate-900">Privacy</Link>
            <Link to="/terms" className="press hover:text-slate-900">Terms</Link>
          </div>
          <Link
            to="/auth"
            className="press inline-flex min-h-10 items-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.9)]"
          >
            Go to my dashboard
          </Link>
        </nav>
      </header>

      {/* Hero + stickers */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-14 sm:pt-24">
        {/* decorative floating stickers (desktop only) */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <div className="absolute -left-6 top-0"><GradedSticker /></div>
          <div className="absolute -left-2 top-[15rem]"><GradeSticker /></div>
          <div className="absolute -left-4 top-[27rem]"><UpcomingSticker /></div>
          <div className="absolute right-0 top-[-1rem]"><CalendarSticker /></div>
          <div className="absolute -right-2 top-[18rem]"><BellSticker /></div>
          <div className="absolute right-0 top-[27.5rem]"><AnnouncementSticker /></div>
          <div className="absolute left-[18rem] top-[38rem]">
            <IconSticker delay="1.8s" duration="8.2s">
              <BookOpen className="h-7 w-7 text-blue-500" />
            </IconSticker>
          </div>
          <div className="absolute right-[18rem] top-[38rem]">
            <IconSticker delay="2.4s" duration="7.8s">
              <CheckSquare className="h-7 w-7 text-emerald-500" />
            </IconSticker>
          </div>
          <div className="absolute left-[36%] top-[9rem] h-3 w-3 rounded-full border border-slate-300/80" />
          <div className="absolute left-[24%] top-[14rem] text-2xl font-light text-slate-300/80">+</div>
          <div className="absolute left-[31%] top-[30rem] text-2xl font-light text-slate-300/70">+</div>
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="text-[2.35rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 sm:text-6xl lg:text-[4.25rem]">
            Hey! Welcome to{" "}
            <span className="text-gradient-animated">CanvasPro.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-slate-500 sm:text-lg">
            Your Canvas experience, finally built around you.
          </p>

          <div className="mt-9 flex justify-center">
            <Link
              to="/auth"
              className="press group inline-flex min-h-14 items-center gap-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-9 text-base font-semibold text-white shadow-[0_22px_45px_-20px_rgba(37,99,235,0.85)]"
            >
              Go to my dashboard
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-6 space-y-1 text-sm text-slate-400">
            <p>
              Free dashboard tier. 2.99/month.{"\u00a0"} Cancel anytime.
              <br />
              Your data is private.{" "}
              <Link to="/privacy" className="font-medium text-blue-600 hover:underline">
                Read the privacy policy.
              </Link>
            </p>
            <p>{"\n"}</p>
            <p>{"\n"}</p>
          </div>

          <a
            href="#features"
            aria-label="Scroll to features"
            className="press mx-auto mt-10 grid h-12 w-12 place-items-center rounded-full border border-slate-200 bg-white/80 text-slate-400 shadow-sm backdrop-blur"
          >
            <ChevronDown className="h-5 w-5" />
          </a>
        </div>

        {/* mobile-friendly sample cards */}
        <div className="mt-12 grid gap-3 px-1 lg:hidden">
          <GradedSticker />
          <UpcomingSticker />
        </div>
      </section>

      {/* Feature strip */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 lg:pt-[8rem]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-slate-200/80">
          {STRIP.map((s) => (
            <div key={s.title} className="flex items-center gap-3 px-0 lg:px-4">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.tint}`}>
                <s.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                <p className="text-xs text-slate-500">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 pb-16">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          What you get
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className={`${CARD} flex flex-col gap-3 p-5`}>
              <f.icon className="h-5 w-5 text-blue-600" />
              <h3 className="text-base font-semibold tracking-tight text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Free tools */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <div className={`${CARD} flex flex-col items-center gap-4 p-8 text-center`}>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Free tools while you're here
          </h2>
          <p className="max-w-xl text-sm text-slate-500">
            No account needed — figure out your grade, or fix the Canvas dashboard
            you already have.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/canvas-grade-calculator" className="press inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700">
              Canvas grade calculator
            </Link>
            <Link to="/canvas-dashboard-guide" className="press inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700">
              Customize your Canvas dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
