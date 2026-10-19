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
          "See every Canvas assignment, grade and deadline in one clean dashboard, sorted by what's due first. Try it free for 14 days.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "CoursePro — A Better Canvas Dashboard for Students" },
      {
        property: "og:description",
        content:
          "See every Canvas assignment, grade and deadline in one clean dashboard, sorted by what's due first. Try it free for 14 days.",
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
        href: "/home/dashboard-dark.webp",
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

/** Real screens of the app. Screenshots live in /public/home, in light and dark. */
const SCREENS = [
  {
    id: "dashboard",
    label: "Dashboard",
    title: "A clearer picture of your day.",
    caption: "Your grades, the next thing to do, and everything due in the next 24 hours.",
    alt: "The CoursePro dashboard with a greeting, the next assignment up, and class grades.",
  },
  {
    id: "coming-up",
    label: "Coming up",
    title: "Your week, with room to breathe.",
    caption: "The week ahead, one day at a time, with how long each assignment should take.",
    alt: "The Coming Up page with a seven-day strip and assignments grouped by day.",
  },
  {
    id: "study",
    label: "Study session",
    title: "A little focus goes a long way.",
    caption: "Pick assignments, choose a total time, time per assignment, or Pomodoro, and start.",
    alt: "The Study Session page: pick assignments on the left, your session and its time on the right.",
  },
  {
    id: "assignments",
    label: "Assignments",
    title: "The right work. In the right order.",
    caption: "Every class in one list, ordered so the most pressing work is on top.",
    alt: "The Assignments page with a weekly count and a ranked list of work.",
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
 * What CoursePro does and doesn't do with an account. Every line matches the
 * Privacy Policy and Support pages; keep them in step if either changes.
 */
const PROMISES = [
  {
    title: "Never your school password",
    body: "You connect with an access token you make in Canvas yourself, and you can revoke it there at any time.",
  },
  {
    title: "Only reads Canvas",
    body: "CoursePro reads your courses, assignments, grades and announcements. It never submits, edits or deletes anything.",
  },
  {
    title: "Not for sale",
    body: "We don't sell your information, use it for ads, or put advertising trackers on the site or in the app.",
  },
  {
    title: "Yours to delete",
    body: "Remove your Canvas key or delete your whole account from Settings, and the data linked to it goes with it.",
  },
];

const MORE = [
  {
    title: "Grades and GPA",
    body: "Every class grade and your GPA in one place, plus a what-if calculator for the final.",
  },
  {
    title: "Reminders",
    body: "A heads-up one to three days before things are due, even when CoursePro is closed.",
  },
  {
    title: "Study sessions",
    body: "Line up a few assignments, set a timer or use Pomodoro, and add white or brown noise.",
  },
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

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
        src={`/home/${id}-dark.webp`}
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
        src={`/home/${id}-light.webp`}
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
        <h2 id="hp-story-title">Take a look around.</h2>
        <p>These are real screens from CoursePro, the way they look with your own classes.</p>
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
                <p className="hp-step__label">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                </p>
                <h3>{item.title}</h3>
                <p>{item.caption}</p>
              </div>
              {/* Phones: the screenshot sits right under its words. */}
              <div className="hp-frame hp-step__shot" data-breathe>
                <Shot id={item.id} alt={item.alt} />
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
                <Shot id={item.id} alt={item.alt} eager={index === 0} />
              </div>
            ))}
          </div>
          <div className="hp-story__dots" role="group" aria-label="Jump to a screen">
            {SCREENS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show ${item.label}`}
                aria-current={index === active ? "step" : undefined}
                onClick={() => show(index)}
              />
            ))}
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
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <>
      {text.split(" ").map((word, index) => (
        <span key={index}>
          <span className="hp-word" style={{ "--i": from + index } as CSSProperties}>
            {word}
          </span>{" "}
        </span>
      ))}
    </>
  );
}

function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pageRef = useBreathe();
  const scrolled = useScrolled();

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
            <p className="hp-hello hp-rise">Made for students who use Canvas</p>
            <h1 id="hp-title" className="hp-rise">
              Every Canvas deadline, <span className="hp-quiet">in the order you should do it.</span>
            </h1>
            <p className="hp-lede hp-rise">
              CoursePro puts your assignments, grades and announcements on one calm page, with the
              next thing to do right at the top. Free for 14 days.
            </p>
            <div className="hp-actions hp-rise">
              <Link to={cta} preload="intent" className="hp-button">
                {ctaLabel}
              </Link>
              <a href="#app-preview" className="hp-link hp-preview-link">
                Take a look around <span aria-hidden="true">↓</span>
              </a>
            </div>
            <ul className="hp-assure hp-rise" aria-label="What to expect">
              <li>
                <Check /> No school password
              </li>
              <li>
                <Check /> Only reads Canvas
              </li>
              <li>
                <Check /> Delete anytime
              </li>
            </ul>
          </div>
          <div className="hp-hero__demo hp-rise">
            <SortingWeek />
            <p className="hp-hero__hint">Check off the top task and watch the next one move up.</p>
          </div>
        </section>

        <ScreenStory />

        <section className="hp-statement" aria-label="Why CoursePro">
          <p data-breathe>
            <Words text="Canvas tells you everything." />{" "}
            <span className="hp-quiet">
              <Words text="CoursePro tells you what’s next." from={4} />
            </span>
          </p>
        </section>

        <section className="hp-split hp-trust" aria-labelledby="hp-trust-title">
          <div className="hp-split__text" data-breathe>
            <h2 id="hp-trust-title">Your classes stay yours.</h2>
            <p>
              Connecting a school account is a big ask, so here is exactly what CoursePro does with
              it, in plain words.
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
          <ul className="hp-promises">
            {PROMISES.map((item, index) => (
              <li
                key={item.title}
                data-breathe
                style={{ "--d": `${index * 0.08}s` } as CSSProperties}
              >
                <span className="hp-promises__check">
                  <Check />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="hp-split" aria-labelledby="hp-more-title">
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
            Make this semester a little calmer.
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
