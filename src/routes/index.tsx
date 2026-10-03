import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Megaphone,
  Menu,
  TimerReset,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import "./landing.css";
import "./landing-motion.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CanvasPro — Make room for what matters" },
      {
        name: "description",
        content:
          "Turn Canvas classes, assignments, grades, and deadlines into one clear plan. Find your next task with Focus, then work through it in a Study Session. Free for students.",
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
          name: "CanvasPro",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          url: "https://canvaspro.app/",
          description:
            "A student dashboard for Canvas LMS with assignments, grades, schedules, Focus, Study Sessions, and a daily plan.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: LandingPage,
});

const tasks = [
  { course: "PHYSICS", title: "Newton's laws", due: "Tonight · 11:59 PM", tone: "lilac" },
  { course: "DESIGN", title: "CAD assignment", due: "Tomorrow · 5:00 PM", tone: "mint" },
  { course: "ENGLISH", title: "Reading response", due: "Friday · 2:00 PM", tone: "peach" },
  { course: "CALCULUS", title: "Integration practice", due: "Sunday · 11:59 PM", tone: "blue" },
];

/** Today's plan in the Get It Done preview. Minutes add up to the total shown. */
const plan = [
  { title: "Physics Homework", course: "Physics 101", due: "Tonight", minutes: 30 },
  { title: "CAD Assignment", course: "Design Studio", due: "Tomorrow", minutes: 45 },
  { title: "Reading Response", course: "English 202", due: "Friday", minutes: 25 },
];
const planTotal = plan.reduce((sum, item) => sum + item.minutes, 0);

/** The study session uses the same three assignments: 100 minutes = four 25-minute rounds. */
const POMODORO_MINUTES = 25;
const STUDY_ROUNDS = Math.ceil(planTotal / POMODORO_MINUTES);
const STUDY_ELAPSED_MINUTES = 12;

const CURRENT_GRADE = 88.4;

const sidebar = [
  { label: "Today", icon: LayoutDashboard, active: true },
  { label: "Study Session", icon: TimerReset },
  { label: "Calendar", icon: CalendarDays },
  { label: "Grades", icon: GraduationCap },
  { label: "Assignments", icon: ListChecks },
  { label: "Announcements", icon: Megaphone },
];

const faq = [
  {
    question: "What does CanvasPro bring together?",
    answer:
      "Your Canvas courses, assignments, grades, announcements, and deadlines appear in one place. Focus and Get It Done help you decide what to work on next.",
  },
  {
    question: "Is CanvasPro free?",
    answer:
      "Yes. CanvasPro's dashboard, planning tools, grade calculator, and notifications are available without a subscription or credit card.",
  },
  {
    question: "How do I connect my Canvas account?",
    answer:
      "Create a CanvasPro account, generate a personal access token in your school's Canvas settings, and add it in CanvasPro. You never enter your school password into CanvasPro.",
  },
  {
    question: "Can I use it on my phone?",
    answer:
      "Yes. The website adapts to smaller screens, and CanvasPro is also available as an iOS app.",
  },
  {
    question: "What happens to an existing subscription?",
    answer:
      "Email support@canvaspro.app and we'll cancel it for you. CanvasPro stays free after cancellation.",
  },
];

function minutesLabel(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`;
}

function clockLabel(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

/** A heading split into lines that slide up one after another when it scrolls into view. */
function Lines({ lines }: { lines: ReactNode[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <span className="cp-line" key={index} style={{ "--line": index } as CSSProperties}>
          <span>{line}</span>
        </span>
      ))}
    </>
  );
}

/** The app's Today tabs, drawn the way the signed-in pages show them. */
function TodayTabs({ active }: { active: "Dashboard" | "Coming Up" | "Get It Done" }) {
  return (
    <div className="cp-app-tabs" aria-hidden="true">
      {(["Dashboard", "Coming Up", "Get It Done"] as const).map((tab) => (
        <span key={tab} className={tab === active ? "is-active" : undefined}>
          {tab}
        </span>
      ))}
    </div>
  );
}

function useStoryMotion() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLElement>(null);
  const focusStageRef = useRef<HTMLDivElement>(null);
  const studyRef = useRef<HTMLElement>(null);
  const studyStageRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const calculatorRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const finaleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = rootRef.current;

    let frame = 0;
    const sceneProgress = { focus: 0, study: 0 };
    let needsFrame = false;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const smooth = (value: number) => {
      const t = clamp(value);
      return t * t * (3 - 2 * t);
    };
    /** 0 when the element's top reaches the bottom of the screen, 1 after `span` screens of scrolling. */
    const entering = (element: Element, span: number) => {
      const rect = element.getBoundingClientRect();
      return clamp((window.innerHeight - rect.top) / (window.innerHeight * span));
    };
    const inView = (rect: DOMRect) => rect.top < window.innerHeight && rect.bottom > 0;
    const parallax = document.querySelectorAll<HTMLElement>(".cp-story [data-parallax]");
    const navLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(".cp-nav__links a[href^='#']"),
    );
    const spySections = navLinks
      .map((link) => document.querySelector<HTMLElement>(link.getAttribute("href") ?? ""))
      .filter((section): section is HTMLElement => Boolean(section));
    let lastPlanDone = -1;
    let lastFocusCount = "";

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;

      // Page-wide: reading progress, the nav pill, and which section is in view.
      // These are state, not motion, so they also run with reduced motion.
      if (root) {
        const scrollable = Math.max(1, document.documentElement.scrollHeight - vh);
        root.style.setProperty("--page-progress", clamp(window.scrollY / scrollable).toFixed(4));
        root.classList.toggle("cp-story--scrolled", window.scrollY > 48);
      }
      let activeHref = "";
      spySections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= vh * 0.45 && rect.bottom > vh * 0.45) {
          activeHref = navLinks[index]?.getAttribute("href") ?? "";
        }
      });
      navLinks.forEach((link) =>
        link.classList.toggle("is-current", link.getAttribute("href") === activeHref),
      );

      // The "why this one" panel sits just under the first row, whatever height
      // the header and row end up at on this screen.
      const focusSurface = focusStageRef.current;
      const firstRow = focusSurface?.querySelector<HTMLElement>(".cp-focus-task--one");
      const focusDemo = focusSurface?.querySelector<HTMLElement>(".cp-focus-demo");
      if (firstRow && focusDemo) {
        focusDemo.style.setProperty(
          "--detail-top",
          `${firstRow.offsetTop + firstRow.offsetHeight + 10}px`,
        );
      }

      if (reduce.matches) return;
      needsFrame = false;

      const sequence = sequenceRef.current;
      const stage = stageRef.current;
      const hero = heroRef.current;
      if (hero) {
        const progress = clamp(-hero.getBoundingClientRect().top / Math.max(hero.offsetHeight, 1));
        hero.style.setProperty("--hero-scroll", progress.toFixed(3));
      }
      parallax.forEach((element) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom < 0 || bounds.top > vh) return;
        const depth = Number(element.dataset.parallax) || 20;
        const progress = (vh - bounds.top) / (vh + bounds.height);
        const shift = (progress - 0.5) * depth * (window.innerWidth <= 760 ? 0.5 : 1);
        element.style.setProperty("--parallax-y", shift.toFixed(1) + "px");
      });
      if (sequence && stage) {
        const rect = sequence.getBoundingClientRect();
        if (rect.top <= vh && rect.bottom >= 0) {
          const distance = Math.max(1, sequence.offsetHeight - vh);
          const progress = clamp(-rect.top / distance);
          const tidy = clamp((progress - 0.19) / 0.53);
          const eased = tidy * tidy * (3 - 2 * tidy);
          const chaos = 1 - clamp((progress - 0.31) / 0.12);
          const clarity = clamp((progress - 0.52) / 0.16);
          stage.style.setProperty("--story-tidy", eased.toFixed(3));
          stage.style.setProperty("--story-chaos", chaos.toFixed(3));
          stage.style.setProperty("--story-clarity", clarity.toFixed(3));
          stage.style.setProperty("--story-progress", progress.toFixed(3));
          // Scattered, but never on top of each other: each card keeps its
          // order, and the vertical spread grows faster than the tilt can close it.
          const width = window.innerWidth;
          const positions =
            width <= 760
              ? [
                  [-10, -16, -2.5],
                  [12, -5, 2.5],
                  [-12, 5, -2],
                  [10, 16, 2],
                ]
              : width <= 1100
                ? [
                    [-24, -30, -3],
                    [26, -10, 3],
                    [-22, 10, -3],
                    [22, 30, 3],
                  ]
                : [
                    [-30, -66, -4],
                    [70, -22, 4],
                    [-20, 22, -3.5],
                    [60, 66, 3.5],
                  ];
          stage.querySelectorAll<HTMLElement>("[data-scatter-card]").forEach((card, index) => {
            const [x, y, rotation] = positions[index];
            const remaining = 1 - eased;
            card.style.transform = `translate3d(${(x * remaining).toFixed(1)}px,${(y * remaining).toFixed(1)}px,0) rotate(${(rotation * remaining).toFixed(2)}deg)`;
          });
        }
      }

      // Get It Done: each row is checked off as it passes the reading line,
      // and "Up next" always names the first unchecked row.
      const planPanel = planRef.current;
      if (planPanel) {
        const panelRect = planPanel.getBoundingClientRect();
        if (inView(panelRect)) {
          planPanel.style.setProperty("--plan-enter", smooth(entering(planPanel, 0.75)).toFixed(3));
          const rows = Array.from(planPanel.querySelectorAll<HTMLElement>("[data-plan-row]"));
          let done = 0;
          rows.forEach((row) => {
            const rowRect = row.getBoundingClientRect();
            const checked = rowRect.top + rowRect.height / 2 < vh * 0.42;
            row.classList.toggle("is-done", checked);
            if (checked) done += 1;
          });
          if (done !== lastPlanDone) {
            lastPlanDone = done;
            planPanel.style.setProperty(
              "--plan-done",
              (done / Math.max(rows.length, 1)).toFixed(3),
            );
            const next = plan[done];
            const title = planPanel.querySelector<HTMLElement>("[data-next-title]");
            const meta = planPanel.querySelector<HTMLElement>("[data-next-meta]");
            const count = planPanel.querySelector<HTMLElement>("[data-plan-count]");
            const percent = planPanel.querySelector<HTMLElement>("[data-plan-percent]");
            if (title) title.textContent = next ? next.title : "All done for today.";
            if (meta) {
              meta.textContent = next
                ? `${next.course} · due ${next.due.toLowerCase()} · about ${next.minutes} min`
                : "Nice work. Everything on today's plan is checked off.";
            }
            if (count) count.textContent = `${done} OF ${rows.length} DONE`;
            if (percent)
              percent.textContent = `${Math.round((done / Math.max(rows.length, 1)) * 100)}%`;
            planPanel.classList.toggle("is-complete", !next);
            const box = planPanel.querySelector<HTMLElement>(".cp-up-next");
            if (box) {
              box.classList.remove("is-swapping");
              void box.offsetWidth;
              box.classList.add("is-swapping");
            }
          }
        }
      }

      const updateScene = (
        section: HTMLElement | null,
        surface: HTMLDivElement | null,
        name: string,
      ) => {
        if (!section || !surface) return;
        const rect = section.getBoundingClientRect();
        if (rect.top > vh || rect.bottom < 0) return;
        const distance = Math.max(1, section.offsetHeight - vh);
        const target = clamp(-rect.top / distance);
        const current = sceneProgress[name as "focus" | "study"];
        const progress =
          Math.abs(target - current) > 0.002 ? current + (target - current) * 0.23 : target;
        sceneProgress[name as "focus" | "study"] = progress;
        if (Math.abs(target - progress) > 0.002) needsFrame = true;
        const eased = smooth((progress - 0.14) / 0.72);
        surface.style.setProperty(`--${name}-progress`, progress.toFixed(3));
        surface.style.setProperty(`--${name}-change`, eased.toFixed(3));
        if (name === "focus") {
          const out = smooth((progress - 0.17) / 0.39);
          surface.style.setProperty("--focus-out", out.toFixed(3));
          surface.style.setProperty(
            "--focus-row-four",
            smooth((progress - 0.14) / 0.17).toFixed(3),
          );
          surface.style.setProperty(
            "--focus-row-three",
            smooth((progress - 0.22) / 0.17).toFixed(3),
          );
          surface.style.setProperty("--focus-row-two", smooth((progress - 0.29) / 0.17).toFixed(3));
          // Starts only once the rows it replaces have fully faded.
          surface.style.setProperty("--focus-in", smooth((progress - 0.47) / 0.22).toFixed(3));
          const label = out < 0.5 ? "4 THIS WEEK" : "1 DUE TODAY";
          if (label !== lastFocusCount) {
            lastFocusCount = label;
            const count = surface.querySelector<HTMLElement>("[data-focus-count]");
            if (count) count.textContent = label;
          }
        }
        if (name === "study") {
          // The list leaves completely before the timer opens, so they never overlap.
          const session = smooth((progress - 0.4) / 0.36);
          surface.style.setProperty("--study-out", smooth((progress - 0.12) / 0.26).toFixed(3));
          surface.style.setProperty("--study-in", session.toFixed(3));
          const total = POMODORO_MINUTES * 60;
          const remaining = total - session * STUDY_ELAPSED_MINUTES * 60;
          const elapsed = (total - remaining) / total;
          surface.style.setProperty("--study-ring", `${(elapsed * 360).toFixed(1)}deg`);
          surface.style.setProperty("--study-round", elapsed.toFixed(3));
          const time = surface.querySelector<HTMLElement>("[data-study-time]");
          if (time) time.textContent = clockLabel(remaining);
        }
      };
      updateScene(focusRef.current, focusStageRef.current, "focus");
      updateScene(studyRef.current, studyStageRef.current, "study");

      const workspace = workspaceRef.current;
      if (workspace) {
        const rect = workspace.getBoundingClientRect();
        if (inView(rect)) {
          const stageElement = workspace.querySelector<HTMLElement>(".cp-workspace__stage");
          const enter = stageElement ? smooth(entering(stageElement, 0.85)) : 1;
          workspace.style.setProperty("--workspace-enter", enter.toFixed(3));
        }
      }

      const calculator = calculatorRef.current;
      if (calculator) {
        const rect = calculator.getBoundingClientRect();
        if (inView(rect)) {
          const enter = smooth((vh - rect.top) / (vh * 1.15));
          calculator.style.setProperty("--calc-tilt", `${(-14 + enter * 20).toFixed(2)}deg`);
          calculator.style.setProperty("--calc-lift", `${((1 - enter) * 32).toFixed(1)}px`);
          const ring = calculator.querySelector<HTMLElement>(".cp-calculator__ring");
          const count = ring ? smooth(entering(ring, 0.8)) : 1;
          const value = CURRENT_GRADE * count;
          calculator.style.setProperty("--calc-value", value.toFixed(2));
          const number = calculator.querySelector<HTMLElement>("[data-grade-value]");
          if (number) number.textContent = value.toFixed(1);
        }
      }

      // How it works: a rail fills as you read down the steps, lighting each one it reaches.
      const steps = stepsRef.current;
      if (steps) {
        const rect = steps.getBoundingClientRect();
        if (inView(rect)) {
          const line = vh * 0.6;
          steps.style.setProperty(
            "--steps-fill",
            clamp((line - rect.top) / rect.height).toFixed(3),
          );
          steps.querySelectorAll<HTMLElement>(".cp-step").forEach((step) => {
            step.classList.toggle("is-reached", step.getBoundingClientRect().top + 24 < line);
          });
        }
      }

      const finale = finaleRef.current;
      if (finale) {
        const rect = finale.getBoundingClientRect();
        if (inView(rect)) {
          finale.style.setProperty("--finale-enter", smooth(entering(finale, 0.9)).toFixed(3));
        }
      }

      if (needsFrame) frame = window.requestAnimationFrame(update);
    };
    const request = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    reduce.addEventListener("change", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      reduce.removeEventListener("change", request);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return {
    rootRef,
    sequenceRef,
    stageRef,
    heroRef,
    planRef,
    focusRef,
    focusStageRef,
    studyRef,
    studyStageRef,
    workspaceRef,
    calculatorRef,
    stepsRef,
    finaleRef,
  };
}

function useReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".cp-story");
    const elements = root?.querySelectorAll<HTMLElement>("[data-reveal], [data-lines]") ?? [];
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    root?.classList.add("cp-story--motion");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.13, rootMargin: "0px 0px -5% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      root?.classList.remove("cp-story--motion");
    };
  }, []);
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <span className={"cp-brand" + (dark ? " cp-brand--dark" : "")}>
      <span className="cp-brand__mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>
        canvaspro<span className="cp-brand__dot">.</span>
      </span>
    </span>
  );
}

function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [targetGrade, setTargetGrade] = useState("90");
  const [view, setView] = useState<"week" | "grades">("week");
  const {
    rootRef,
    sequenceRef,
    stageRef,
    heroRef,
    planRef,
    focusRef,
    focusStageRef,
    studyRef,
    studyStageRef,
    workspaceRef,
    calculatorRef,
    stepsRef,
    finaleRef,
  } = useStoryMotion();
  useReveal();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setIsLoggedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  const cta = isLoggedIn ? "/dashboard" : "/signup";
  const finalNeeded = Math.max(
    0,
    Math.ceil(((Number(targetGrade) - CURRENT_GRADE * 0.75) / 0.25) * 10) / 10,
  );
  const studyRemaining = POMODORO_MINUTES * 60 - STUDY_ELAPSED_MINUTES * 60;

  return (
    <div className="cp-story" ref={rootRef}>
      <a className="cp-skip" href="#main-story">
        Skip to content
      </a>
      <div className="cp-progress" aria-hidden="true">
        <span />
      </div>
      <header className="cp-nav">
        <Link to="/" className="cp-nav__brand" aria-label="CanvasPro home">
          <Brand />
        </Link>
        <nav
          className={"cp-nav__links" + (menuOpen ? " cp-nav__links--open" : "")}
          aria-label="Main navigation"
        >
          <a href="#experience" onClick={() => setMenuOpen(false)}>
            The experience
          </a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#questions" onClick={() => setMenuOpen(false)}>
            Questions
          </a>
          <Link to="/canvas-grade-calculator" preload="intent" onClick={() => setMenuOpen(false)}>
            Grade calculator
          </Link>
          <Link
            to={isLoggedIn ? "/dashboard" : "/auth"}
            preload="intent"
            className="cp-nav__mobile-signin"
            onClick={() => setMenuOpen(false)}
          >
            {isLoggedIn ? "Dashboard" : "Sign in"}
          </Link>
        </nav>
        <div className="cp-nav__actions">
          <Link
            to={isLoggedIn ? "/dashboard" : "/auth"}
            preload="intent"
            className="cp-nav__signin"
          >
            {isLoggedIn ? "Dashboard" : "Sign in"}
          </Link>
          <Link to={cta} preload="intent" className="cp-button cp-button--nav">
            {isLoggedIn ? "Open app" : "Get started"} <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="cp-nav__menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <main id="main-story">
        <section className="cp-hero" ref={heroRef} aria-labelledby="cp-hero-title">
          <div className="cp-hero__halo" aria-hidden="true" />
          <div className="cp-hero__grid" aria-hidden="true" />
          <div className="cp-hero__eyebrow">
            <span className="cp-eyebrow-line" /> THE STUDENT DAY, REIMAGINED
          </div>
          <h1 id="cp-hero-title">
            <span className="cp-hero__line cp-hero__line--one">A clearer day</span>
            <span className="cp-hero__line cp-hero__line--two">
              starts <em>here.</em>
            </span>
          </h1>
          <p className="cp-hero__intro">
            Every class. Every deadline. One place to see what matters and move forward.
          </p>
          <div className="cp-hero__actions">
            <Link to={cta} preload="intent" className="cp-button cp-button--light">
              {isLoggedIn ? "Open your dashboard" : "Make your day easier"}{" "}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a href="#experience" className="cp-text-link">
              Explore the experience <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
          <div className="cp-hero__objects" aria-hidden="true">
            <div className="cp-orbit cp-orbit--one">
              <span className="cp-orbit__dot cp-orbit__dot--violet" /> PHYSICS II{" "}
              <strong>94.2%</strong>
            </div>
            <div className="cp-orbit cp-orbit--two">
              <CalendarDays size={16} /> Lab report <span>Tomorrow</span>
            </div>
            <div className="cp-orbit cp-orbit--three">
              <Check size={16} /> One thing at a time
            </div>
            <div className="cp-orbit cp-orbit--four">
              <Bell size={16} /> Due tonight <span>11:59 PM</span>
            </div>
          </div>
          <div className="cp-hero__bottom">
            <span>BUILT AROUND THE WAY STUDENTS ACTUALLY WORK</span>
            <span>
              SCROLL TO EXPLORE <ArrowDown size={14} />
            </span>
          </div>
        </section>

        <section
          className="cp-sequence"
          id="experience"
          ref={sequenceRef}
          aria-label="From scattered work to a clear plan"
        >
          <div className="cp-sequence__stage" ref={stageRef}>
            <div className="cp-sequence__grain" aria-hidden="true" />
            <div className="cp-sequence__copy cp-sequence__copy--chaos">
              <span className="cp-kicker">01 / THE PROBLEM</span>
              <h2>
                Too many tabs.
                <br />
                Too much <em>noise.</em>
              </h2>
              <p>
                Assignments hide inside courses. Deadlines compete for attention. Figuring out where
                to begin becomes its own task.
              </p>
            </div>
            <div className="cp-sequence__copy cp-sequence__copy--clarity">
              <span className="cp-kicker">02 / THE SHIFT</span>
              <h2>
                Now it all
                <br />
                <em>makes sense.</em>
              </h2>
              <p>
                CanvasPro brings the pieces together and points you toward the work that matters
                now.
              </p>
            </div>
            <div
              className="cp-sequence__canvas"
              aria-label="Example assignments organizing into one list"
            >
              <span className="cp-sequence__caption">YOUR WORK, IN ONE VIEW</span>
              {tasks.map((task, index) => (
                <div
                  key={task.title}
                  className={"cp-scatter-card cp-scatter-card--" + task.tone}
                  data-scatter-card
                >
                  <span className="cp-scatter-card__index">0{index + 1}</span>
                  <span className="cp-scatter-card__body">
                    <small>{task.course}</small>
                    <strong>{task.title}</strong>
                  </span>
                  <span className="cp-scatter-card__due">{task.due}</span>
                </div>
              ))}
              <div className="cp-sequence__line" aria-hidden="true" />
            </div>
            <div className="cp-sequence__progress" aria-hidden="true">
              <span />
            </div>
          </div>
        </section>

        <div className="cp-story-bridge cp-story-bridge--night-to-day" aria-hidden="true" />

        <section className="cp-plan" aria-labelledby="cp-plan-title">
          <div className="cp-plan__topline">
            <span>03 / YOUR NEXT MOVE</span>
            <span>LESS GUESSING. MORE DOING.</span>
          </div>
          <div className="cp-plan__layout">
            <div className="cp-plan__copy" data-reveal>
              <span className="cp-kicker cp-kicker--dark">GET IT DONE</span>
              <h2 id="cp-plan-title" data-lines>
                <Lines
                  lines={[
                    "A plan that",
                    <>
                      feels <em>possible.</em>
                    </>,
                  ]}
                />
              </h2>
              <p>
                Start with one recommended assignment. Then follow a realistic plan for the rest of
                today, with time estimates and room to adjust.
              </p>
              <Link to={cta} preload="intent" className="cp-inline-link">
                See what to do next <ArrowRight size={18} />
              </Link>
            </div>
            <div className="cp-plan__visual">
              <div
                className="cp-product-panel cp-product-panel--plan"
                ref={planRef}
                aria-label={`Get It Done preview: ${plan.length} assignments planned for today, ${minutesLabel(planTotal)} in total, checked off one at a time`}
                role="img"
              >
                <div className="cp-product-panel__chrome" aria-hidden="true">
                  <Brand dark />
                  <span>
                    TODAY <span className="cp-live-dot" />
                  </span>
                </div>
                <div className="cp-product-panel__content" aria-hidden="true">
                  <TodayTabs active="Get It Done" />
                  <div className="cp-panel-label">UP NEXT</div>
                  <div className="cp-up-next">
                    <h3 data-next-title>{plan[0].title}</h3>
                    <p data-next-meta>
                      {plan[0].course} · due {plan[0].due.toLowerCase()} · about {plan[0].minutes}{" "}
                      min
                    </p>
                    <span className="cp-panel-primary">
                      Start <ArrowRight size={15} />
                    </span>
                  </div>
                  <div className="cp-panel-heading">
                    <strong>Today’s plan</strong>
                    <span>{minutesLabel(planTotal)} total</span>
                  </div>
                  {plan.map((item, index) => (
                    <div
                      className="cp-plan-row"
                      key={item.title}
                      data-plan-row
                      style={{ "--row": index } as CSSProperties}
                    >
                      <span className="cp-plan-row__check">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {item.course} · {item.due}
                        </small>
                      </div>
                      <em>{item.minutes} min</em>
                    </div>
                  ))}
                  <div className="cp-panel-progress">
                    <span data-plan-count>0 OF {plan.length} DONE</span>
                    <span data-plan-percent>0%</span>
                    <div>
                      <i />
                    </div>
                  </div>
                </div>
              </div>
              <p className="cp-plan__side-note" aria-hidden="true">
                NOT A PERFECT DAY. A STARTABLE ONE.
              </p>
            </div>
          </div>
        </section>

        <section className="cp-focus-story" ref={focusRef} aria-labelledby="cp-focus-title">
          <div className="cp-focus-story__stage" ref={focusStageRef}>
            <div className="cp-feature-copy cp-feature-copy--focus">
              <span className="cp-kicker">04 / COMING UP</span>
              <h2 id="cp-focus-title">
                A whole week.
                <br />
                <em>One clear place to start.</em>
              </h2>
              <p>
                Filter the noise by due date, see each class together, and find the assignment that
                needs your attention now.
              </p>
              <Link
                to={isLoggedIn ? "/focus" : "/signup"}
                preload="intent"
                className="cp-feature-link"
              >
                Open Coming Up <ArrowRight size={18} />
              </Link>
            </div>
            <div
              className="cp-focus-demo"
              role="img"
              aria-label="Coming Up preview: four assignments due this week narrow to Newton’s Laws Homework, with a clear reason to start it today"
            >
              <div className="cp-focus-demo__header">
                <TodayTabs active="Coming Up" />
                <span className="cp-focus-demo__live">
                  SYNCED <i />
                </span>
              </div>
              <div className="cp-focus-demo__filters" aria-hidden="true">
                <span className="cp-focus-demo__filter-state">
                  <span className="cp-focus-demo__week">1 WEEK</span>
                  <span className="cp-focus-demo__day">DUE TODAY</span>
                </span>
                <span className="cp-focus-demo__count" data-focus-count>
                  4 THIS WEEK
                </span>
              </div>
              <div className="cp-focus-demo__list" aria-hidden="true">
                <div className="cp-focus-task cp-focus-task--one">
                  <small>
                    PHYSICS 101 <b>TONIGHT</b>
                  </small>
                  <strong>Newton’s Laws Homework</strong>
                  <span>Due 11:59 PM · 30 min</span>
                </div>
                <div className="cp-focus-task cp-focus-task--two">
                  <small>
                    DESIGN STUDIO <b>TOMORROW</b>
                  </small>
                  <strong>CAD Assignment</strong>
                  <span>Due 5:00 PM · 45 min</span>
                </div>
                <div className="cp-focus-task cp-focus-task--three">
                  <small>
                    ENGLISH 202 <b>FRIDAY</b>
                  </small>
                  <strong>Reading Response</strong>
                  <span>Due 2:00 PM · 25 min</span>
                </div>
                <div className="cp-focus-task cp-focus-task--four">
                  <small>
                    CALCULUS II <b>SUNDAY</b>
                  </small>
                  <strong>Integration Practice</strong>
                  <span>Due 11:59 PM · 40 min</span>
                </div>
              </div>
              <div className="cp-focus-demo__detail" aria-hidden="true">
                <span>WHY THIS ONE</span>
                <p>Due tonight, and short enough to finish in one focused block.</p>
                <div className="cp-focus-demo__detail-foot">
                  <strong>30 MIN TO DONE</strong>
                  <span>
                    START WITH THIS <ArrowRight size={17} />
                  </span>
                </div>
              </div>
            </div>
            <span className="cp-feature-index" aria-hidden="true">
              04 — COMING UP
            </span>
          </div>
        </section>

        <div className="cp-story-bridge cp-story-bridge--day-to-night" aria-hidden="true" />

        <section className="cp-study-story" ref={studyRef} aria-labelledby="cp-study-title">
          <div className="cp-study-story__stage" ref={studyStageRef}>
            <div className="cp-feature-copy cp-feature-copy--study">
              <span className="cp-kicker">05 / STUDY SESSION</span>
              <h2 id="cp-study-title">
                Now give it
                <br />
                <em>your full attention.</em>
              </h2>
              <p>
                Pick your assignments and CanvasPro turns them into focused pomodoro rounds, with
                short breaks in between.
              </p>
              <Link
                to={isLoggedIn ? "/study-session" : "/signup"}
                preload="intent"
                className="cp-feature-link"
              >
                Start a Study Session <ArrowRight size={18} />
              </Link>
            </div>
            <div
              className="cp-study-demo"
              role="img"
              aria-label={`Study Session preview: three assignments, ${minutesLabel(planTotal)} in total, become ${STUDY_ROUNDS} focus rounds of ${POMODORO_MINUTES} minutes`}
            >
              <div className="cp-study-demo__selection" aria-hidden="true">
                <span>
                  YOUR SESSION <small>{minutesLabel(planTotal)}</small>
                </span>
                {plan.map((item) => (
                  <div key={item.title}>
                    <Check size={16} /> {item.title} <small>{item.minutes} MIN</small>
                  </div>
                ))}
                <p className="cp-study-demo__plan">
                  {STUDY_ROUNDS} ROUNDS · {POMODORO_MINUTES} MIN FOCUS · 5 MIN BREAKS
                </p>
              </div>
              <div className="cp-study-demo__timer" aria-hidden="true">
                <span className="cp-study-demo__eyebrow">FOCUS · ROUND 1 OF {STUDY_ROUNDS}</span>
                <div className="cp-study-demo__ring">
                  <div>
                    <strong data-study-time>{clockLabel(studyRemaining)}</strong>
                    <small>PHYSICS 101</small>
                  </div>
                </div>
                <strong className="cp-study-demo__task">{plan[0].title}</strong>
                <div className="cp-study-demo__rounds">
                  {Array.from({ length: STUDY_ROUNDS }, (_, index) => (
                    <span key={index} className={index === 0 ? "is-current" : undefined}>
                      <i />
                    </span>
                  ))}
                </div>
                <span className="cp-study-demo__next">UP NEXT / 5 MIN BREAK</span>
              </div>
              <div className="cp-study-demo__halo" aria-hidden="true" />
            </div>
            <span className="cp-feature-index" aria-hidden="true">
              05 — STAY WITH IT
            </span>
          </div>
        </section>

        <section className="cp-workspace" ref={workspaceRef} aria-labelledby="cp-workspace-title">
          <div className="cp-workspace__intro" data-reveal>
            <span className="cp-kicker">06 / THE WHOLE PICTURE</span>
            <h2 id="cp-workspace-title" data-lines>
              <Lines lines={["Clarity is a", <em key="em">powerful feeling.</em>]} />
            </h2>
            <p>
              See how your courses, deadlines, and grades connect. The dashboard stays useful when
              the semester gets complicated.
            </p>
          </div>
          <div className="cp-workspace__stage">
            <div className="cp-workspace__rail" aria-hidden="true">
              <span className="cp-workspace__rail-title">
                <Brand />
              </span>
              <div className="cp-workspace__rail-items">
                {sidebar.map(({ label, icon: Icon, active }, index) => (
                  <span
                    key={label}
                    className={active ? "is-active" : undefined}
                    style={{ "--item": index } as CSSProperties}
                  >
                    <Icon size={17} />
                    <b>{label}</b>
                  </span>
                ))}
              </div>
              <span className="cp-workspace__rail-bottom">CP</span>
            </div>
            <div className="cp-workspace__window">
              <div className="cp-workspace__main">
                <div className="cp-workspace__window-head">
                  <div>
                    <small>TODAY</small>
                    <strong>{view === "week" ? "A week in view." : "Every grade, in view."}</strong>
                  </div>
                  <span className="cp-sync">
                    <span /> CANVAS SYNCED
                  </span>
                </div>
                <div className="cp-workspace__tiles" aria-hidden="true">
                  <div>
                    <small>DUE THIS WEEK</small>
                    <strong>3</strong>
                  </div>
                  <div>
                    <small>OVERDUE</small>
                    <strong>0</strong>
                  </div>
                </div>
                <div className="cp-workspace__tabs" role="tablist" aria-label="Dashboard preview">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "week"}
                    onClick={() => setView("week")}
                  >
                    This week
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "grades"}
                    onClick={() => setView("grades")}
                  >
                    Grades
                  </button>
                </div>
                {view === "week" ? (
                  <div className="cp-week" role="tabpanel" key="week">
                    <div className="cp-week__days">
                      {[
                        ["MON", "21"],
                        ["TUE", "22"],
                        ["WED", "23"],
                        ["THU", "24"],
                        ["FRI", "25"],
                      ].map(([day, date]) => (
                        <div key={day}>
                          <small>{day}</small>
                          <strong>{date}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="cp-week__schedule">
                      <div className="cp-week__schedule-label">
                        <span>UPCOMING</span>
                        <span>3 ASSIGNMENTS</span>
                      </div>
                      {[
                        ["Wed", "Physics problem set", "Physics II · 30 min"],
                        ["Thu", "CAD assignment", "Engineering Design · 45 min"],
                        ["Fri", "Reading response", "Modern Texts · 25 min"],
                      ].map(([day, title, detail]) => (
                        <div className="cp-week__assignment" key={title}>
                          <span>{day}</span>
                          <div>
                            <strong>{title}</strong>
                            <small>{detail}</small>
                          </div>
                          <Check size={16} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="cp-grades" role="tabpanel" key="grades">
                    {[
                      ["Physics II", "94.2%", "A"],
                      ["Calculus III", "88.7%", "B+"],
                      ["Engineering Design", "97.5%", "A+"],
                    ].map(([course, grade, letter]) => (
                      <div key={course}>
                        <span>{course}</span>
                        <strong>{grade}</strong>
                        <em>{letter}</em>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="cp-workspace__side" aria-hidden="true">
                <div className="cp-workspace__card cp-workspace__card--grade">
                  <span>CALCULUS III</span>
                  <strong>88.7%</strong>
                  <small>Current grade · B+</small>
                </div>
                <div className="cp-workspace__card cp-workspace__card--notice">
                  <Bell size={17} />
                  <div>
                    <strong>Heads up</strong>
                    <span>Physics is due Wednesday.</span>
                  </div>
                </div>
                <div className="cp-workspace__card cp-workspace__card--class">
                  <span>NEXT CLASS</span>
                  <strong>Physics II</strong>
                  <small>Mon · 9:00 AM · Room 204</small>
                </div>
              </div>
            </div>
          </div>
          <div className="cp-workspace__details" data-reveal>
            <span>LIVE GRADES</span>
            <span>SMART DEADLINES</span>
            <span>CLASS SCHEDULE</span>
            <span>NOTIFICATIONS</span>
          </div>
        </section>

        <div className="cp-story-bridge cp-story-bridge--night-to-mint" aria-hidden="true" />

        <section
          className="cp-calculator"
          ref={calculatorRef}
          aria-labelledby="cp-calculator-title"
        >
          <div className="cp-calculator__visual" data-reveal>
            <div className="cp-calculator__ring" aria-hidden="true">
              <i className="cp-calculator__arc" />
              <span>
                <b data-grade-value>{CURRENT_GRADE.toFixed(1)}</b>
                <small>%</small>
              </span>
            </div>
            <div className="cp-calculator__card" aria-live="polite" aria-atomic="true">
              <span>FINAL GRADE PREDICTOR</span>
              <strong key={targetGrade} className="cp-calculator__result">
                {finalNeeded > 100 ? "Over 100%" : finalNeeded.toFixed(1) + "%"}
              </strong>
              <small>needed on your final exam</small>
            </div>
          </div>
          <div className="cp-calculator__copy" data-reveal>
            <span className="cp-kicker cp-kicker--dark">07 / KNOW WHERE YOU STAND</span>
            <h2 id="cp-calculator-title" data-lines>
              <Lines lines={["No more", <em key="em">grade guessing.</em>]} />
            </h2>
            <p>
              Grades update alongside your classes. Try a target below to see what the final exam
              math looks like.
            </p>
            <label htmlFor="cp-target-grade">YOUR TARGET COURSE GRADE</label>
            <select
              id="cp-target-grade"
              value={targetGrade}
              onChange={(event) => setTargetGrade(event.target.value)}
            >
              <option value="80">80% · B−</option>
              <option value="85">85% · B</option>
              <option value="90">90% · A−</option>
              <option value="93">93% · A</option>
            </select>
            <small className="cp-calculator__note">
              Example: {CURRENT_GRADE}% current grade, final worth 25%.
            </small>
            <Link to="/canvas-grade-calculator" preload="intent" className="cp-inline-link">
              Open the full grade calculator <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <div className="cp-story-bridge cp-story-bridge--mint-to-night" aria-hidden="true" />

        <section className="cp-steps" id="how-it-works" aria-labelledby="cp-steps-title">
          <div className="cp-steps__heading" data-reveal>
            <span className="cp-kicker">08 / BEGIN SIMPLY</span>
            <h2 id="cp-steps-title" data-lines>
              <Lines lines={["Three small steps.", <em key="em">A lot more breathing room.</em>]} />
            </h2>
          </div>
          <div className="cp-steps__list" ref={stepsRef}>
            <span className="cp-steps__rail" aria-hidden="true">
              <i />
            </span>
            {[
              ["01", "Create your space", "Make a free CanvasPro account in minutes."],
              [
                "02",
                "Connect Canvas",
                "Add a personal access token from your school's Canvas settings.",
              ],
              [
                "03",
                "Find your rhythm",
                "See your classes, choose a next task, and make the day yours.",
              ],
            ].map(([number, title, detail]) => (
              <div className="cp-step" key={number} data-reveal>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{detail}</p>
                <ChevronRight size={20} aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="cp-steps__trust" data-reveal>
            <LockKeyhole size={18} />
            <p>
              Your school password stays with your school. CanvasPro connects using the token you
              create in Canvas.
            </p>
          </div>
        </section>

        <div className="cp-story-bridge cp-story-bridge--night-to-paper" aria-hidden="true" />

        <section className="cp-questions" id="questions" aria-labelledby="cp-questions-title">
          <div className="cp-questions__intro" data-reveal>
            <span className="cp-kicker cp-kicker--dark">GOOD TO KNOW</span>
            <h2 id="cp-questions-title" data-lines>
              <Lines lines={["A few things", "you might", <em key="em">wonder.</em>]} />
            </h2>
            <p>Clear answers, just like the rest of your day.</p>
          </div>
          <Accordion type="single" collapsible className="cp-questions__list" data-reveal>
            {faq.map((item, index) => (
              <AccordionItem key={item.question} value={"question-" + index}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <div className="cp-story-bridge cp-story-bridge--paper-to-night" aria-hidden="true" />

        <section className="cp-finale" ref={finaleRef} aria-labelledby="cp-finale-title">
          <div className="cp-finale__glow" aria-hidden="true" />
          <div className="cp-finale__content" data-reveal>
            <span className="cp-kicker">YOUR NEXT CHAPTER STARTS HERE</span>
            <h2 id="cp-finale-title" data-lines>
              <Lines
                lines={[
                  "Less looking.",
                  <>
                    More <em>living.</em>
                  </>,
                ]}
              />
            </h2>
            <p>A place for your coursework to make sense. Free for every student.</p>
            <Link to={cta} preload="intent" className="cp-button cp-button--light">
              {isLoggedIn ? "Open your dashboard" : "Get started for free"} <ArrowRight size={18} />
            </Link>
            <span className="cp-finale__fineprint">
              NO SUBSCRIPTION. NO CREDIT CARD. JUST A CLEARER DAY.
            </span>
          </div>
          <div className="cp-finale__orb" aria-hidden="true">
            <Brand />
          </div>
        </section>
      </main>
    </div>
  );
}
