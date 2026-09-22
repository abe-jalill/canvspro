import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  Calculator,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Canvas Pro — A Better Canvas Dashboard for Students" },
      {
        name: "description",
        content:
          "See every Canvas class, grade, and deadline in one clean dashboard — with notifications tuned to your day. First 10 days of Pro free, then $2.99/month or $30/year (save 17%).",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://canvaspro.app/" },
      {
        property: "og:image",
        content: "https://canvaspro.app/canvaspro-homepage-preview.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: "https://canvaspro.app/canvaspro-homepage-preview.png",
      },
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
            price: "0",
            priceCurrency: "USD",
          },
        }),
      },
    ],
  }),
  component: LandingPage,
});

const DEMO_COURSES = [
  {
    name: "Physics II",
    code: "PHY 2049",
    score: "94.2%",
    letter: "A",
    trend: "+1.8%",
    trendUp: true,
    color: "from-blue-500/20 to-blue-500/5",
    accent: "text-blue-400",
  },
  {
    name: "Calculus III",
    code: "MAC 2313",
    score: "88.7%",
    letter: "B+",
    trend: "+0.4%",
    trendUp: true,
    color: "from-emerald-500/20 to-emerald-500/5",
    accent: "text-emerald-400",
  },
  {
    name: "Computer Science I",
    code: "COP 3502",
    score: "97.5%",
    letter: "A+",
    trend: "Stable",
    trendUp: true,
    color: "from-purple-500/20 to-purple-500/5",
    accent: "text-purple-400",
  },
  {
    name: "Organic Chemistry",
    code: "CHM 2210",
    score: "85.0%",
    letter: "B",
    trend: "-0.9%",
    trendUp: false,
    color: "from-amber-500/20 to-amber-500/5",
    accent: "text-amber-400",
  },
];

const DEMO_ASSIGNMENTS = [
  {
    title: "Problem Set 4: Binary Trees",
    course: "Computer Science I",
    due: "Due in 3 hours",
    urgency: "urgent",
  },
  {
    title: "Electromagnetism Lab Report",
    course: "Physics II",
    due: "Due tomorrow, 11:59 PM",
    urgency: "warning",
  },
  {
    title: "Triple Integrals Practice Set",
    course: "Calculus III",
    due: "Due Friday, 5:00 PM",
    urgency: "normal",
  },
  {
    title: "Mechanism Synthesis Quiz",
    course: "Organic Chemistry",
    due: "Due Sunday, 11:59 PM",
    urgency: "normal",
  },
];

const UNIVERSITIES = [
  "University of Florida",
  "Penn State",
  "Ohio State",
  "Arizona State",
  "UC Berkeley",
  "UT Austin",
  "Purdue",
  "UW Madison",
  "Rutgers",
  "1,000+ Canvas Schools",
];

const TESTIMONIALS = [
  {
    quote:
      "I used to keep 10+ Canvas tabs open every Sunday night trying to piece together what was due. Having every deadline, class score, and countdown on one screen cut my weekly planning time to 2 minutes.",
    author: "Anonymous",
    school: "LTU '29 • Civil Engineering",
    stars: 5,
  },
  {
    quote:
      "The built-in final exam calculator alone is worth it. It automatically told me I needed an 81% on my Chem final to keep an A, instead of me guessing with an Excel spreadsheet at 2 AM.",
    author: "Omar S.",
    school: "UofM - Dearborn • Finance ",
    stars: 5,
  },
  {
    quote:
      "Being able to rename cryptic codes like 'MAC2313-004-FA26' to just 'Calc 3' and dragging widgets in the order I want is what Canvas should have been all along.",
    author: "Liam D.",
    school: "ASU '28 • Business",
    stars: 5,
  },
];

const FAQS = [
  {
    question: "Is Canvas Pro allowed by my school or university?",
    answer:
      "Yes. Canvas Pro uses your personal Canvas Access Token, an official feature provided directly by Instructure Canvas for third-party student tools. It operates strictly within your existing student permissions.",
  },
  {
    question: "Can Canvas Pro see my Canvas password or change my grades?",
    answer:
      "No, never. You never enter your school password or institutional credentials. Canvas Pro only receives a read-only access token. It cannot alter grades, submit assignments, post announcements, or make any changes to your Canvas account.",
  },
  {
    question: "How do I get my Canvas Access Token?",
    answer:
      "It takes about 30 seconds: Log in to your school's Canvas website, click 'Account' in the left menu, choose 'Settings', scroll down to 'Approved Integrations', and click '+ New Access Token'. Copy that token into Canvas Pro and your dashboard immediately populates.",
  },
  {
    question: "How much does Canvas Pro cost?",
    answer:
      "Nothing right now. Every feature is free for every account: live Canvas sync, the final exam predictor, focus due-date windows, workload heatmap, .ics calendar export, and automated notification alerts. No card required.",
  },
  {
    question: "Do I need to enter payment details?",
    answer:
      "No. There is no subscription and no payment step — create an account, add your Canvas access token, and everything is unlocked.",
  },
  {
    question: "Does Canvas Pro work on mobile phones and tablets?",
    answer:
      "Yes! Canvas Pro is built as a progressive, fully responsive web application that runs smoothly in Safari, Chrome, iOS, and Android. You can even add it directly to your home screen like an app.",
  },
];

function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeDemoTab, setActiveDemoTab] = useState<"grades" | "assignments" | "calculator">("grades");
  const [demoFinalTarget, setDemoFinalTarget] = useState<string>("90");

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
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      {/* Logged in notification banner */}
      {isLoggedIn && (
        <div className="glass-panel-strong mb-10 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Welcome back!</p>
              <p className="text-xs text-muted-foreground">You are signed in to your Canvas Pro account.</p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="glass-hover inline-flex min-h-10 items-center justify-center rounded-xl bg-foreground px-5 text-xs font-semibold text-background"
          >
            Go to my dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Hero Section */}
      <section className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3.5 py-1 text-xs font-medium text-foreground/80 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>A calmer Canvas experience — Loved by students</span>
        </div>

        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          A calmer, faster dashboard for your Canvas classes
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Canvas Pro pulls your live grades, upcoming assignments, schedules, and announcements into one
          customizable home screen. Stop hunting through nested course menus.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {isLoggedIn ? (
            <Link
              to="/dashboard"
              className="glass-hover inline-flex min-h-12 items-center justify-center rounded-xl bg-foreground px-7 text-sm font-semibold text-background"
            >
              Open Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="glass-hover inline-flex min-h-12 items-center justify-center rounded-xl bg-foreground px-7 text-sm font-semibold text-background"
              >
                Get started free <ArrowRight className="ml-2 h-4 w-4" />
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

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Free dashboard tier
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 2-minute setup
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 100% Read-only security
          </span>
        </div>
      </section>

      {/* Interactive Live Dashboard Preview Mockup */}
      <section className="mt-12 sm:mt-16">
        <div className="glass-panel-strong overflow-hidden border border-foreground/15 p-1.5 shadow-2xl">
          {/* Mock Browser / Window Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3 bg-foreground/[0.02]">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/60" />
                <span className="h-3 w-3 rounded-full bg-amber-500/60" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
              </div>
              <span className="ml-2 rounded-md bg-foreground/5 px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                canvaspro.app/dashboard
              </span>
            </div>

            {/* Interactive Demo Switcher */}
            <div className="flex items-center gap-1 rounded-xl bg-foreground/5 p-1">
              <button
                type="button"
                onClick={() => setActiveDemoTab("grades")}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium transition",
                  activeDemoTab === "grades"
                    ? "bg-foreground/15 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Live Grades
              </button>
              <button
                type="button"
                onClick={() => setActiveDemoTab("assignments")}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium transition",
                  activeDemoTab === "assignments"
                    ? "bg-foreground/15 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Up Next
              </button>
              <button
                type="button"
                onClick={() => setActiveDemoTab("calculator")}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium transition",
                  activeDemoTab === "calculator"
                    ? "bg-foreground/15 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Finals Calculator
              </button>
            </div>
          </div>

          {/* Interactive Mockup Body */}
          <div className="p-4 sm:p-6">
            {activeDemoTab === "grades" && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">Current Course Scores</h3>
                    <p className="text-xs text-muted-foreground">Real-time sync with trend indicators</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Synced 2m ago
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {DEMO_COURSES.map((course) => (
                    <div
                      key={course.name}
                      className={cn(
                        "glass-inset flex items-center justify-between p-4 transition-all hover:border-foreground/20",
                        "bg-gradient-to-br",
                        course.color,
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">{course.name}</h4>
                          <span className="text-[11px] font-mono text-muted-foreground">{course.code}</span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3 text-emerald-400" />
                          <span>{course.trend} recently</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold tracking-tight text-foreground">{course.score}</span>
                        <span className={cn("block text-xs font-semibold", course.accent)}>{course.letter}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeDemoTab === "assignments" && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">Upcoming Deadlines</h3>
                    <p className="text-xs text-muted-foreground">Countdown badges sorted by urgency</p>
                  </div>
                  <span className="text-xs text-muted-foreground">4 items due this week</span>
                </div>

                <div className="space-y-2.5">
                  {DEMO_ASSIGNMENTS.map((item) => (
                    <div
                      key={item.title}
                      className="glass-inset flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-foreground/20">
                          <Check className="h-3 w-3 text-transparent hover:text-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.course}</p>
                        </div>
                      </div>
                      <div className="self-end sm:self-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium",
                            item.urgency === "urgent" && "bg-red-500/15 text-red-400 border border-red-500/30",
                            item.urgency === "warning" && "bg-amber-500/15 text-amber-400 border border-amber-500/30",
                            item.urgency === "normal" && "bg-foreground/5 text-muted-foreground border border-foreground/10",
                          )}
                        >
                          <Clock className="h-3 w-3" />
                          {item.due}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeDemoTab === "calculator" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">Final Exam Grade Predictor</h3>
                    <p className="text-xs text-muted-foreground">Calculates exact score needed on your final exam</p>
                  </div>
                  <span className="text-xs font-medium text-purple-400">Physics II (PHY 2049)</span>
                </div>

                <div className="glass-inset grid gap-4 p-4 sm:grid-cols-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Current Grade</span>
                    <p className="mt-1 text-xl font-bold text-foreground">88.4% (B+)</p>
                    <span className="text-[11px] text-muted-foreground">75% of class graded</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Final Exam Weight</span>
                    <p className="mt-1 text-xl font-bold text-foreground">25%</p>
                    <span className="text-[11px] text-muted-foreground">Weighted category</span>
                  </div>
                  <div>
                    <label htmlFor="target-grade" className="text-xs text-muted-foreground">
                      Target Course Grade
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <select
                        id="target-grade"
                        value={demoFinalTarget}
                        onChange={(e) => setDemoFinalTarget(e.target.value)}
                        className="rounded-lg border border-foreground/20 bg-background px-2.5 py-1 text-sm font-semibold text-foreground"
                      >
                        <option value="93">93% (A)</option>
                        <option value="90">90% (A-)</option>
                        <option value="87">87% (B+)</option>
                        <option value="80">80% (B-)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4 text-center">
                  <p className="text-xs font-medium text-purple-300">You need to score at least</p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight text-purple-200">
                    {demoFinalTarget === "93"
                      ? "106.8% (Extra credit needed)"
                      : demoFinalTarget === "90"
                      ? "94.8%"
                      : demoFinalTarget === "87"
                      ? "82.8%"
                      : "54.8%"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    on the final exam to finish with a {demoFinalTarget}% in this course.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* University Trust Banner */}
      <section className="mt-14 border-y border-foreground/10 py-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Works with Canvas LMS at 1,000+ colleges & high schools
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {UNIVERSITIES.map((school) => (
            <span
              key={school}
              className="rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs text-muted-foreground"
            >
              {school}
            </span>
          ))}
        </div>
      </section>

      {/* Key Benefits Grid */}
      <section className="mt-16">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Everything in one place
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Designed for how students actually study
          </h2>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="glass-panel flex flex-col gap-3 p-5">
            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">A homepage you arrange</h3>
            <p className="text-sm text-muted-foreground">
              Drag widgets for calendar, grades, assignments, announcements, focus, and workload into the order you
              actually use. Hide the rest.
            </p>
          </article>

          <article className="glass-panel flex flex-col gap-3 p-5">
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">Live grades with trend arrows</h3>
            <p className="text-sm text-muted-foreground">
              Every class score in one list, with indicators showing whenever your professor posts new marks.
            </p>
          </article>

          <article className="glass-panel flex flex-col gap-3 p-5">
            <Calculator className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">Grade calculator & finals math</h3>
            <p className="text-sm text-muted-foreground">
              Weighted category calculations and an automated final-exam score estimator — no spreadsheets required.
            </p>
          </article>

          <article className="glass-panel flex flex-col gap-3 p-5">
            <ListChecks className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">Smart assignments with countdowns</h3>
            <p className="text-sm text-muted-foreground">
              Grouped by class, sorted by due date, with urgency badges and one-tap completion tracking.
            </p>
          </article>

          <article className="glass-panel flex flex-col gap-3 p-5">
            <Timer className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">Focus windows</h3>
            <p className="text-sm text-muted-foreground">
              Filter your dashboard to show only what's due in the next 24 hours, 48 hours, 3 days, or this week.
            </p>
          </article>

          <article className="glass-panel flex flex-col gap-3 p-5">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">Workload heatmap</h3>
            <p className="text-sm text-muted-foreground">
              Spot brutal exam and deadline weeks at a single glance so you can prep ahead instead of cramming.
            </p>
          </article>

          <article className="glass-panel flex flex-col gap-3 p-5">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">Class schedules & .ics export</h3>
            <p className="text-sm text-muted-foreground">
              Sync your due dates and recurring classes directly into Google Calendar, Apple Calendar, or Outlook in one
              tap.
            </p>
          </article>

          <article className="glass-panel flex flex-col gap-3 p-5">
            <Pencil className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">Friendly course nicknames</h3>
            <p className="text-sm text-muted-foreground">
              Rename cryptic departmental course codes like <code className="rounded bg-foreground/10 px-1 py-0.5">PHY1154-04</code> to clean, readable names like <span className="font-semibold">Physics</span>.
            </p>
          </article>

          <article className="glass-panel flex flex-col gap-3 p-5">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">Notifications you control</h3>
            <p className="text-sm text-muted-foreground">
              Get notified only about what matters to you: upcoming due windows, newly posted grades, and announcements.
            </p>
          </article>
        </div>
      </section>

      {/* How it Works & Security Reassurance */}
      <section className="mt-16">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            3-minute setup
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            How Canvas Pro works
          </h2>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <article className="glass-panel p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10 text-xs font-bold text-foreground">
              1
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight">Create your account</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign up with email and password, or continue with your Google or Apple account in seconds.
            </p>
          </article>

          <article className="glass-panel p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10 text-xs font-bold text-foreground">
              2
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight">Paste your Canvas token</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a personal read-only access token from your school's Canvas Settings. 3 quick clicks.
            </p>
          </article>

          <article className="glass-panel p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10 text-xs font-bold text-foreground">
              3
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight">Customize your view</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Give your courses friendly nicknames, arrange your widgets, and enjoy a clutter-free semester.
            </p>
          </article>
        </div>

        {/* Security Box */}
        <div className="glass-panel-strong mt-6 border border-emerald-500/20 bg-emerald-500/[0.03] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-foreground">
                Your credentials and student privacy are 100% protected
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                We never ask for your school password. Your Canvas token is stored encrypted write-only and is restricted to read-only access. Canvas Pro cannot edit grades, submit coursework, or modify your school account in any way.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Student Testimonials */}
      <section className="mt-16">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Student Reviews
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Trusted by students across the country
          </h2>
          <div className="mt-2 flex items-center justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
            <span className="ml-1.5 text-xs font-medium text-foreground">4.9 / 5 rating</span>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <article key={t.author} className="glass-panel flex flex-col justify-between p-5">
              <div>
                <div className="flex gap-0.5 text-amber-400">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-sm italic text-foreground/90">"{t.quote}"</p>
              </div>
              <div className="mt-4 border-t border-foreground/10 pt-3">
                <p className="text-xs font-semibold text-foreground">{t.author}</p>
                <p className="text-[11px] text-muted-foreground">{t.school}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Free for everyone */}
      <section className="mt-16">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Simple Pricing
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything is free right now.
          </h2>
        </div>

        <div className="glass-panel-strong mx-auto mt-8 flex max-w-2xl flex-col items-center gap-4 p-8 text-center">
          <p className="text-3xl font-bold tracking-tight text-foreground">$0</p>
          <p className="text-sm text-muted-foreground">
            Every feature unlocked for every student — no card, no subscription.
          </p>
          <ul className="grid w-full gap-2.5 text-left text-sm text-foreground/90 sm:grid-cols-2">
            {[
              "Live Canvas grades, assignments & announcements",
              "Automated final exam score estimator",
              "Focus view (1-day to 1-week due windows)",
              "Workload heatmap & syllabus links",
              ".ics calendar export (Google, Apple, Outlook)",
              "Smart notifications & daily recap",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/signup"
            className="glass-hover inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background sm:w-auto"
          >
            Create your free account
          </Link>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="mt-16">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Got questions?
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="glass-panel-strong mx-auto mt-8 max-w-3xl p-6">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`}>
                <AccordionTrigger className="text-left text-sm font-semibold text-foreground">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Free Tools Banner */}
      <section className="glass-panel mt-16 flex flex-col items-center gap-4 p-8 text-center">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Try our free standalone student tools
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          No account needed — calculate what you need on your final exam or learn how to customize Canvas.
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
            Customize Canvas guide
          </Link>
        </div>
      </section>
    </div>
  );
}