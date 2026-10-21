import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HomeFooter } from "@/components/home-footer";
import "./home.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoursePro — A Better Canvas Dashboard for Students" },
      {
        name: "description",
        content:
          "See every Canvas assignment, grade and deadline in one clean dashboard, sorted by what's due first. Free to use right now.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "CoursePro — A Better Canvas Dashboard for Students" },
      {
        property: "og:description",
        content:
          "See every Canvas assignment, grade and deadline in one clean dashboard, sorted by what's due first. Free to use right now.",
      },
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
    links: [
      { rel: "canonical", href: "https://canvaspro.app/" },
      // The first screenshot in the tour sits just below the hero; fetch it early.
      {
        rel: "preload",
        as: "image",
        href: `/home/dashboard-dark.webp?v=${SHOTS_VERSION}`,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "CoursePro",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          url: "https://canvaspro.app/",
          description:
            "A student dashboard for Canvas LMS with assignments, grades, schedules, Study Sessions, and a daily plan.",
          offers: {
            "@type": "Offer",
            price: "0.00",
            priceCurrency: "USD",
            description:
              "Free to use while paid plans ($5.00 per month or $50.00 per year) are coming soon",
          },
        }),
      },
    ],
  }),
  component: LandingPage,
});

/**
 * The screenshots' version. The tour's highlight boxes (each screen's `focus`)
 * are measured on these exact images, and browsers and the service worker keep
 * old copies of an unchanged URL, so recapturing the screens means re-measuring
 * `focus` and changing this together.
 */
const SHOTS_VERSION = "todo-2026-10-21";

/** Real screens of the app. Screenshots live in /public/home, in light and dark. */
const SCREENS = [
  {
    id: "dashboard",
    label: "Today",
    title: "A clearer picture of your day.",
    caption: "Your week at a glance, and the one thing to do next with a button to start it.",
    alt: "The CoursePro Today page with a greeting, seven days as circles, and the next assignment up.",
    focus: { x: 62.2, y: 10.8, w: 34.7, h: 24.8, label: "The one thing to do next" },
  },
  {
    id: "todo",
    label: "To-Do",
    title: "Your week, with room to breathe.",
    caption: "Everything due, one day at a time, with how long each assignment should take.",
    alt: "The To-Do page with the week's progress and assignments grouped by day.",
    focus: { x: 28.8, y: 17.3, w: 60.6, h: 7.5, label: "Your week, done and to go" },
  },
  {
    id: "study",
    label: "Study session",
    title: "A little focus goes a long way.",
    caption: "Pick assignments, choose a total time, time per assignment, or Pomodoro, and start.",
    alt: "The Study Session page: pick assignments on the left, your session and its time on the right.",
    focus: { x: 71.2, y: 27.9, w: 16.6, h: 30, label: "Your session at a glance" },
  },
  {
    id: "assignments",
    label: "Assignments",
    title: "The right work. In the right order.",
    caption: "Every class in one list, ordered so the most pressing work is on top.",
    alt: "The Assignments page with a weekly count and a ranked list of work.",
    focus: { x: 23.5, y: 64.4, w: 71.3, h: 7.7, label: "What to do right now, in plain words" },
  },
] as const;

/** One student's week. `sorted` is the order CoursePro would suggest. */
const TASKS = [
  {
    id: "webassign",
    title: "WebAssign 3.4: Derivatives",
    course: "Calculus I",
    due: "Due today, 11:59 PM",
    today: true,
    time: "45 min",
    sorted: 0,
  },
  {
    id: "lab-report",
    title: "Lab Report 2",
    course: "General Chemistry",
    due: "Due tomorrow",
    today: false,
    time: "2 hr",
    sorted: 1,
  },
  {
    id: "reading",
    title: "Reading Response 5",
    course: "Intro to Psychology",
    due: "Due Thursday",
    today: false,
    time: "30 min",
    sorted: 2,
  },
  {
    id: "prelab",
    title: "Lab 4: Osmosis Prelab",
    course: "Cell Biology",
    due: "Due Friday",
    today: false,
    time: "40 min",
    sorted: 3,
  },
  {
    id: "bibliography",
    title: "Annotated Bibliography",
    course: "College Writing",
    due: "Due Monday",
    today: false,
    time: "1.5 hr",
    sorted: 4,
  },
];

/** The same work as Canvas lists it: alphabetical, with no sense of what comes first. */
const CANVAS_ORDER = [...TASKS].sort((a, b) => a.title.localeCompare(b.title));
const SORTED_ORDER = [...TASKS].sort((a, b) => a.sorted - b.sorted);

/**
 * What CoursePro reads and what it never does. Every line matches the Privacy
 * Policy and Support pages; keep them in step if either changes.
 */
const READS = [
  "Your courses and class names",
  "Assignments, due dates and whether you've submitted",
  "Grades and how each class weights them",
  "Announcements from each class",
];
const NEVER = [
  "Asks for your school password",
  "Submits, edits or deletes anything in Canvas",
  "Sells your information or uses it for ads",
];

/** The sample student's classes, as the demo and the screenshots show them. */
const GRADES = [
  { course: "College Writing", score: 95 },
  { course: "Cell Biology", score: 93 },
  { course: "Calculus I", score: 90 },
  { course: "Intro to Psychology", score: 88 },
  { course: "General Chemistry", score: 82 },
];

/** Written the way CoursePro's own reminders read. */
const NOTES = [
  { when: "now", title: "Cell Biology starts in 15 min", body: "Class reminder" },
  {
    when: "6:00 PM",
    title: "Due tonight by 11:59 PM: WebAssign 3.4",
    body: "WebAssign 3.4: Derivatives · Calculus I",
  },
  { when: "9:00 AM", title: "Lab Report 2 is due tomorrow at 11:59 PM", body: "General Chemistry" },
];

const MORE = [
  {
    title: "Class schedule",
    body: "Enter your class times once and get a reminder before each one starts.",
  },
  {
    title: "Announcements",
    body: "New posts from every class in one feed, without opening each course.",
  },
  {
    title: "Your colors",
    body: "Four color themes, light or dark, and a wallpaper to match.",
  },
];

const SETUP = [
  {
    title: "Create a free account",
    body: "An email and a password. That's all CoursePro asks for.",
  },
  {
    title: "Make a key in Canvas",
    body: "In Canvas, open Account, then Settings, and click New Access Token. Copy the key it shows.",
  },
  {
    title: "Paste it in Settings",
    body: "Your classes, grades and deadlines show up right away.",
  },
];

const FAQ = [
  {
    question: "What does CoursePro bring together?",
    answer:
      "Your Canvas courses, assignments, grades, announcements, and deadlines appear in one place, with a clear next step.",
  },
  {
    question: "Is my information safe?",
    answer:
      "CoursePro only reads your Canvas data, never asks for your school password, and doesn't sell your information or use it for ads. You can revoke the Canvas token or delete your account at any time. The Privacy Policy explains exactly what is kept and for how long.",
  },
  {
    question: "How much does CoursePro cost?",
    answer:
      "CoursePro is free to use right now. Paid plans are coming soon: $5.00 a month or $50.00 a year, with a 14-day free trial.",
  },
  {
    question: "How do I connect my Canvas account?",
    answer:
      "Create an account, make a personal access token in your school's Canvas settings, and add it in CoursePro. You never enter your school password.",
  },
  {
    question: "Is CoursePro part of Canvas or my school?",
    answer:
      "No. CoursePro is an independent app. It isn't affiliated with, endorsed by or sponsored by Instructure, Canvas LMS or your school.",
  },
  {
    question: "Can I use it on my phone?",
    answer: "Yes. The website works on any screen, and CoursePro is also coming to iPhone.",
  },
];

// Layout effects run before paint on the client; the server has no layout.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A week of work as Canvas lists it. When it scrolls into view it sorts itself
 * into the order to do it; visitors can check off the top task and watch the
 * next one move up. Rows glide to their new places (measured before and after).
 */
function SortingWeek() {
  const [sorted, setSorted] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [finishing, setFinishing] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const tops = useRef(new Map<string, number>());

  // Sort once the visitor can actually see it happen.
  useEffect(() => {
    const el = sheet.current;
    if (!el || prefersReducedMotion() || !("IntersectionObserver" in window)) {
      setSorted(true);
      return;
    }
    let timer = 0;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        watch.disconnect();
        // In the hero it waits for the entrance to finish first.
        timer = window.setTimeout(() => setSorted(true), 1400);
      },
      { threshold: 0.6 },
    );
    watch.observe(el);
    return () => {
      watch.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const visible = (sorted ? SORTED_ORDER : CANVAS_ORDER).filter((task) => !done.includes(task.id));

  // Each row glides from where it was to where it is now. offsetTop is
  // relative to the list, so the page's own scrolling doesn't count.
  useBrowserLayoutEffect(() => {
    const still = prefersReducedMotion();
    rows.current.forEach((row, id) => {
      const top = row.offsetTop;
      const before = tops.current.get(id);
      if (!still && before !== undefined && before !== top) {
        row.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], {
          duration: 820,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
      }
      tops.current.set(id, top);
    });
  });

  function finish(id: string) {
    if (finishing) return;
    setFinishing(id);
    window.setTimeout(
      () => {
        tops.current.delete(id);
        setDone((list) => [...list, id]);
        setFinishing(null);
      },
      prefersReducedMotion() ? 0 : 480,
    );
  }

  function startOver() {
    tops.current.clear();
    setDone([]);
  }

  return (
    <div className="hp-week" ref={sheet} aria-label="Example: one student's week">
      <div className="hp-week__head">
        <span>This week</span>
        <span className={"hp-week__state" + (sorted ? " is-sorted" : "")} aria-live="polite">
          {sorted ? "Sorted by CoursePro" : "As Canvas lists them"}
        </span>
      </div>
      {visible.length === 0 ? (
        <div className="hp-week__empty">
          <p>Nothing left this week. Nice work.</p>
          <button type="button" onClick={startOver}>
            Start over
          </button>
        </div>
      ) : (
        <ol className="hp-week__list">
          {visible.map((task, index) => {
            const next = sorted && index === 0;
            return (
              <li
                key={task.id}
                ref={(el) => {
                  if (el) rows.current.set(task.id, el);
                  else rows.current.delete(task.id);
                }}
                className={
                  "hp-task" +
                  (next ? " is-next" : "") +
                  (finishing === task.id ? " is-finishing" : "")
                }
              >
                <button
                  type="button"
                  className="hp-task__check"
                  onClick={() => finish(task.id)}
                  disabled={!sorted || finishing !== null}
                  aria-label={`Mark ${task.title} done`}
                />
                <div className="hp-task__body">
                  <p className="hp-task__title">{task.title}</p>
                  <p className="hp-task__meta">
                    {task.course} ·{" "}
                    <span className={task.today ? "hp-task__today" : undefined}>{task.due}</span>
                  </p>
                </div>
                <div className="hp-task__side">
                  {next && <span className="hp-task__next">Next</span>}
                  <span className="hp-task__time">{task.time}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * The page is dark unless the visitor picked Light in the app, so both
 * screenshots are on the page and CSS shows one. The hidden one is lazy, and
 * hidden lazy images never download.
 */
function Shot({ id, alt, eager }: { id: string; alt: string; eager?: boolean }) {
  return (
    <>
      <img
        className="hp-shot-dark"
        src={`/home/${id}-dark.webp?v=${SHOTS_VERSION}`}
        alt={alt}
        width={1600}
        height={1000}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        draggable={false}
      />
      <img
        className="hp-shot-light"
        src={`/home/${id}-light.webp?v=${SHOTS_VERSION}`}
        alt={alt}
        width={1600}
        height={1000}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </>
  );
}

/**
 * One screenshot that, while `on`, eases in on the part of the screen its step
 * describes and outlines it. The zoom is a translate and scale of the whole
 * shot, kept inside the frame, so no empty edge ever shows.
 */
function FocusShot({
  screen,
  eager,
}: {
  screen: (typeof SCREENS)[number];
  eager?: boolean;
}) {
  const { x, y, w, h, label } = screen.focus;
  // Close enough to read the detail, never so close the outline leaves the frame.
  const scale = Math.min(1.6, 96 / w, Math.max(1.3, 72 / w));
  const clamp = (value: number) => Math.min(0, Math.max(100 - 100 * scale, value));
  const style = {
    "--s": scale,
    "--tx": `${clamp(50 - scale * (x + w / 2))}%`,
    "--ty": `${clamp(50 - scale * (y + h / 2))}%`,
  } as CSSProperties;
  return (
    <div className="hp-zoom" style={style}>
      <Shot id={screen.id} alt={screen.alt} eager={eager} />
      <span
        className="hp-focus"
        aria-hidden="true"
        style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
      />
      <span
        className="hp-focus__label"
        aria-hidden="true"
        style={{ left: `${x}%`, top: `${y + h}%` }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * A tour of the real app. On wide screens the words scroll on the left while
 * the screenshot on the right stays put and changes to match the step in the
 * middle of the screen. On phones each step carries its own screenshot.
 */
function ScreenStory() {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    // A thin band across the middle of the screen: whichever step crosses it is shown.
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    steps.current.forEach((step) => step && watch.observe(step));
    return () => watch.disconnect();
  }, []);

  function show(index: number) {
    steps.current[index]?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
  }

  return (
    <section id="app-preview" className="hp-story" aria-labelledby="hp-story-title">
      <div className="hp-story__intro" data-breathe>
        <h2 id="hp-story-title">What you&rsquo;ll use every day</h2>
        <p>Real screens from CoursePro, shown with a sample student&rsquo;s classes.</p>
      </div>
      <div className="hp-story__grid" style={{ "--step": active } as CSSProperties}>
        <ol className="hp-story__steps">
          {SCREENS.map((item, index) => (
            <li
              key={item.id}
              ref={(element) => {
                steps.current[index] = element;
              }}
              data-step={index}
              className={"hp-step" + (index === active ? " is-active" : "")}
            >
              <div className="hp-step__copy" data-breathe>
                <button type="button" className="hp-step__label" onClick={() => show(index)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                </button>
                <h3>{item.title}</h3>
                <p>{item.caption}</p>
              </div>
              {/* Phones: the screenshot sits right under its words. */}
              <div className="hp-frame hp-step__shot" data-breathe>
                <FocusShot screen={item} />
              </div>
            </li>
          ))}
        </ol>
        <div className="hp-story__stage">
          <div className="hp-frame hp-story__frame">
            {SCREENS.map((item, index) => (
              <div
                key={item.id}
                className={
                  "hp-story__shot" +
                  (index === active ? " is-shown" : index < active ? " is-past" : "")
                }
                aria-hidden={index !== active}
              >
                <FocusShot screen={item} eager={index === 0} />
              </div>
            ))}
          </div>
          <div className="hp-story__meta" aria-hidden="true">
            <span>{SCREENS[active].label}</span>
            <span className="hp-story__count">
              {String(active + 1).padStart(2, "0")} / {String(SCREENS.length).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Sections breathe in as they first scroll into view. */
function useBreathe() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion() || !("IntersectionObserver" in window)) return;
    // Only what starts below the fold waits; what's already on screen stays put.
    // Hidden elements (the other layout's screenshots) have no box and are skipped.
    const waiting = Array.from(root.querySelectorAll<HTMLElement>("[data-breathe]")).filter(
      (el) => el.getClientRects().length > 0 && el.getBoundingClientRect().top > window.innerHeight * 0.92,
    );
    waiting.forEach((el) => el.classList.add("is-waiting"));
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove("is-waiting");
          watch.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    waiting.forEach((el) => watch.observe(el));
    return () => watch.disconnect();
  }, []);
  return ref;
}

/** The top bar gains a line and a solid background once the page scrolls. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return scrolled;
}

/** One word at a time, so the line reads itself in as it arrives. */
/**
 * The statement lights up word by word as it scrolls up the screen, and dims
 * again if the visitor scrolls back. Returns how many words are lit.
 */
function useLitWords(total: number) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [lit, setLit] = useState(total);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const view = window.innerHeight;
      // From the line's top reaching 85% of the screen to its bottom reaching 45%.
      const progress = (view * 0.85 - box.top) / (box.height + view * 0.4);
      setLit(Math.round(Math.min(1, Math.max(0, progress)) * total));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [total]);
  return { ref, lit };
}

function Words({ text, from = 0, lit }: { text: string; from?: number; lit: number }) {
  return (
    <>
      {text.split(" ").map((word, index) => (
        <span key={index}>
          <span className={"hp-word" + (from + index < lit ? " is-lit" : "")}>{word}</span>{" "}
        </span>
      ))}
    </>
  );
}

/** Adds is-live while the element is on screen, so its loops only run when seen. */
function useLive<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-live");
      return;
    }
    const watch = new IntersectionObserver(
      ([entry]) => el.classList.toggle("is-live", Boolean(entry?.isIntersecting)),
      { threshold: 0.35 },
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return ref;
}

/** Three features shown doing their job, in the app's own words and classes. */
function LiveScenes() {
  const ref = useLive<HTMLDivElement>();
  return (
    <div className="hp-scenes" ref={ref}>
      <figure className="hp-scene" data-breathe>
        <div className="hp-scene__stage hp-notes" aria-hidden="true">
          {NOTES.map((note, index) => (
            <div key={note.title} className="hp-note" style={{ "--n": index } as CSSProperties}>
              <img src="/canvaspro-icon-v2-180.png" alt="" width={28} height={28} />
              <div>
                <p className="hp-note__top">
                  <span>CoursePro</span>
                  <span>{note.when}</span>
                </p>
                <p className="hp-note__title">{note.title}</p>
                <p className="hp-note__body">{note.body}</p>
              </div>
            </div>
          ))}
        </div>
        <figcaption>
          <h3>Reminders</h3>
          <p>Before a class starts, the night something is due, and days ahead. Even with CoursePro closed.</p>
        </figcaption>
      </figure>

      <figure className="hp-scene" data-breathe style={{ "--d": "0.08s" } as CSSProperties}>
        <div className="hp-scene__stage hp-grades" aria-hidden="true">
          {GRADES.map((grade, index) => (
            <div
              key={grade.course}
              className="hp-grade"
              style={{ "--v": `${grade.score}%`, "--n": index } as CSSProperties}
            >
              <span className="hp-grade__name">{grade.course}</span>
              <span className="hp-grade__score">{grade.score}%</span>
              <span className="hp-grade__bar" />
            </div>
          ))}
        </div>
        <figcaption>
          <h3>Grades and GPA</h3>
          <p>Every class grade and your GPA in one place, plus a what-if calculator for the final.</p>
        </figcaption>
      </figure>

      <figure className="hp-scene" data-breathe style={{ "--d": "0.16s" } as CSSProperties}>
        <div className="hp-scene__stage hp-timer" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="112" height="112">
            <circle className="hp-timer__track" cx="60" cy="60" r="52" />
            <circle className="hp-timer__run" cx="60" cy="60" r="52" pathLength="100" />
          </svg>
          <div className="hp-timer__queue">
            <p className="hp-timer__mode">Pomodoro · 25 min</p>
            <p className="is-now">Lab Report 2</p>
            <p>Reading Response 5</p>
            <p>WebAssign 3.4</p>
          </div>
        </div>
        <figcaption>
          <h3>Study sessions</h3>
          <p>Line up a few assignments, set a timer or use Pomodoro, and add white or brown noise.</p>
        </figcaption>
      </figure>
    </div>
  );
}

function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pageRef = useBreathe();
  const scrolled = useScrolled();
  const statement = useLitWords(9);

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
  const ctaLabel = isLoggedIn ? "Open your dashboard" : "Get started free";

  return (
    <div className="hp hp-home" ref={pageRef}>
      <a className="hp-skip" href="#main">
        Skip to content
      </a>

      <header className={"hp-bar" + (scrolled ? " is-scrolled" : "")}>
        <div className="hp-bar__inner">
          <Link to="/" className="hp-brand" aria-label="CoursePro home">
            <img
              className="hp-brand__mark"
              src="/canvaspro-icon-v2-180.png"
              alt=""
              width={26}
              height={26}
            />
            CoursePro
          </Link>
          <nav className="hp-bar__links" aria-label="Main navigation">
            <Link to="/canvas-grade-calculator" preload="intent" className="hp-bar__secondary">
              Grade calculator
            </Link>
            {!isLoggedIn && (
              <Link to="/auth" preload="intent">
                Sign in
              </Link>
            )}
            <Link to={cta} preload="intent" className="hp-button hp-button--small">
              {isLoggedIn ? "Open app" : "Get started"}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="hp-hero" aria-labelledby="hp-title">
          <div className="hp-hero__text">
            <h1 id="hp-title" className="hp-rise">
              Every Canvas deadline, <span className="hp-quiet">in the order you should do it.</span>
            </h1>
            <p className="hp-lede hp-rise">
              CoursePro puts your assignments, grades and announcements on one calm page, with the
              next thing to do right at the top. Free to use right now.
            </p>
            <div className="hp-actions hp-rise">
              <Link to={cta} preload="intent" className="hp-button">
                {ctaLabel}
              </Link>
              <a href="#app-preview" className="hp-link hp-preview-link">
                See the app <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="hp-hero__fine hp-rise">
              Works with your school&rsquo;s Canvas. You never share your school password.
            </p>
          </div>
          <div className="hp-hero__demo hp-rise">
            <SortingWeek />
            <p className="hp-hero__hint">Check off the top task and watch the next one move up.</p>
          </div>
        </section>

        <ScreenStory />

        <section className="hp-statement" aria-label="Why CoursePro">
          <p ref={statement.ref}>
            <Words text="Canvas tells you everything." lit={statement.lit} />{" "}
            <Words text="CoursePro tells you what’s next." from={4} lit={statement.lit} />
          </p>
        </section>

        <section className="hp-split hp-trust" aria-labelledby="hp-trust-title">
          <div className="hp-split__text" data-breathe>
            <h2 id="hp-trust-title">What CoursePro can see</h2>
            <p>
              You connect with an access token you make in Canvas yourself. Here is everything it
              lets CoursePro do, and what it never does.
            </p>
            <p className="hp-muted">
              Read the{" "}
              <Link to="/privacy" className="hp-link">
                Privacy Policy
              </Link>{" "}
              or email{" "}
              <a href="mailto:support@canvaspro.app" className="hp-link">
                support@canvaspro.app
              </a>{" "}
              with any question.
            </p>
          </div>
          <div className="hp-ledger" data-breathe style={{ "--d": "0.1s" } as CSSProperties}>
            <div className="hp-ledger__col">
              <h3>It reads</h3>
              <ul>
                {READS.map((line, index) => (
                  <li key={line} style={{ "--n": index } as CSSProperties}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="hp-ledger__col hp-ledger__col--never">
              <h3>It never</h3>
              <ul>
                {NEVER.map((line, index) => (
                  <li key={line} style={{ "--n": index + READS.length } as CSSProperties}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <p className="hp-ledger__foot">
              Remove the key or delete your account from Settings whenever you like. You can also
              revoke the token in Canvas under Settings, Approved Integrations.
            </p>
          </div>
        </section>

        <section className="hp-split hp-features" aria-labelledby="hp-more-title">
          <div className="hp-split__text" data-breathe>
            <h2 id="hp-more-title">Also in CoursePro</h2>
            <p className="hp-muted">
              No account yet? Try the free{" "}
              <Link to="/canvas-grade-calculator" className="hp-link">
                Canvas grade calculator
              </Link>{" "}
              for what-if and weighted grades.
            </p>
          </div>
          <LiveScenes />
          <dl className="hp-more">
            {MORE.map((item, index) => (
              <div
                key={item.title}
                data-breathe
                style={{ "--d": `${index * 0.06}s` } as CSSProperties}
              >
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="hp-split" aria-labelledby="hp-setup-title">
          <div className="hp-split__text" data-breathe>
            <h2 id="hp-setup-title">Set up in about a minute</h2>
            <p>
              You never type your school password into CoursePro. The key only lets it read your
              courses, and you can revoke it in Canvas at any time.
            </p>
          </div>
          <ol className="hp-steps">
            {SETUP.map((item, index) => (
              <li key={item.title} data-breathe style={{ "--d": `${index * 0.1}s` } as CSSProperties}>
                <span className="hp-steps__n" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="hp-split" aria-labelledby="hp-faq-title">
          <div className="hp-split__text" data-breathe>
            <h2 id="hp-faq-title">Questions</h2>
          </div>
          <Accordion
            type="single"
            collapsible
            className="hp-faq"
            data-breathe
            style={{ "--d": "0.12s" } as CSSProperties}
          >
            {FAQ.map((item, index) => (
              <AccordionItem
                key={item.question}
                value={"question-" + index}
                className="hp-faq__item"
              >
                <AccordionTrigger className="hp-faq__q">{item.question}</AccordionTrigger>
                <AccordionContent className="hp-faq__a">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="hp-end" aria-labelledby="hp-end-title">
          <h2 id="hp-end-title" data-breathe>
            Try it with your own classes.
          </h2>
          <div className="hp-actions" data-breathe style={{ "--d": "0.12s" } as CSSProperties}>
            <Link to={cta} preload="intent" className="hp-button">
              {ctaLabel}
            </Link>
            <span className="hp-muted">
              Free for now. Paid plans are coming soon.{" "}
              <Link to="/pricing" className="hp-link">
                See pricing
              </Link>
            </span>
          </div>
        </section>
      </main>
      <HomeFooter />
    </div>
  );
}
