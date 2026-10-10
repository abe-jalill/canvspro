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
      { title: "CanvasPro | Less Planning. More Doing." },
      {
        name: "description",
        content:
          "Stay on top of assignments, manage deadlines, and organize your college workload with CanvasPro. Spend less time planning and more time getting things done.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "CanvasPro | Less Planning. More Doing." },
      {
        property: "og:description",
        content:
          "Stay on top of assignments, manage deadlines, and organize your college workload with CanvasPro. Spend less time planning and more time getting things done.",
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
      // The homepage's one typeface.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..700&display=swap",
      },
      // The first screenshot is the hero image; fetch it early.
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
          name: "CanvasPro",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          url: "https://canvaspro.app/",
          description:
            "A student dashboard for Canvas LMS with assignments, grades, schedules, Study Sessions, and a daily plan.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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
    caption: "Your grades, the next thing to do, and everything due in the next 24 hours.",
    alt: "The CanvasPro dashboard with a greeting, the next assignment up, and class grades.",
  },
  {
    id: "coming-up",
    label: "Coming up",
    caption: "The week ahead, one day at a time, with how long each assignment should take.",
    alt: "The Coming Up page with a seven-day strip and assignments grouped by day.",
  },
  {
    id: "study",
    label: "Study session",
    caption: "Pick assignments, choose a total time, time per assignment, or Pomodoro, and start.",
    alt: "The Study Session page: pick assignments on the left, your session and its time on the right.",
  },
  {
    id: "assignments",
    label: "Assignments",
    caption: "Every class in one list, ordered so the most pressing work is on top.",
    alt: "The Assignments page with a weekly count and a ranked list of work.",
  },
] as const;

/** One student's week. `sorted` is the order CanvasPro would suggest. */
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

const MORE = [
  {
    title: "Grades and GPA",
    body: "Every class grade and your GPA in one place, plus a what-if calculator for the final.",
  },
  {
    title: "Reminders",
    body: "A heads-up one to three days before things are due, even when CanvasPro is closed.",
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

const FAQ = [
  {
    question: "What does CanvasPro bring together?",
    answer:
      "Your Canvas courses, assignments, grades, announcements, and deadlines appear in one place, with a clear next step.",
  },
  {
    question: "Is CanvasPro free?",
    answer: "Yes. 100% free, no payment method required.",
  },
  {
    question: "How do I connect my Canvas account?",
    answer:
      "Create an account, make a personal access token in your school's Canvas settings, and add it in CanvasPro. You never enter your school password.",
  },
  {
    question: "Can I use it on my phone?",
    answer: "Yes. The website works on any screen, and CanvasPro is also coming to iPhone.",
  },
  {
    question: "What happens to an existing subscription?",
    answer:
      "Email support@canvaspro.app and we'll cancel it for you. CanvasPro stays free after cancellation.",
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
        timer = window.setTimeout(() => setSorted(true), 700);
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
        <span className="hp-week__state" aria-live="polite">
          {sorted ? "Sorted by CanvasPro" : "As Canvas lists them"}
        </span>
      </div>
      {visible.length === 0 ? (
        <div className="hp-week__empty">
          <p>Nothing left this week.</p>
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
      />
      <img
        className="hp-shot-light"
        src={`/home/${id}-light.webp`}
        alt={alt}
        width={1600}
        height={1000}
        loading="lazy"
        decoding="async"
      />
    </>
  );
}

/** Sections breathe in as they first scroll into view. */
function useBreathe() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion() || !("IntersectionObserver" in window)) return;
    // Only what starts below the fold waits; what's already on screen stays put.
    const waiting = Array.from(root.querySelectorAll<HTMLElement>("[data-breathe]")).filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight * 0.92,
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

function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [screen, setScreen] = useState(0);
  const pageRef = useBreathe();

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
    <div className="hp" ref={pageRef}>
      <a className="hp-skip" href="#main">
        Skip to content
      </a>

      <header className="hp-bar">
        <Link to="/" className="hp-brand" aria-label="CanvasPro home">
          CanvasPro
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
      </header>

      <main id="main">
        <section className="hp-hero" aria-labelledby="hp-title">
          <h1 id="hp-title" className="hp-rise">
            Every Canvas deadline, <span className="hp-quiet">in the order you should do it.</span>
          </h1>
          <div className="hp-hero__side">
            <p className="hp-lede hp-rise">
              CanvasPro reads your courses and puts your assignments, grades and announcements on
              one calm page. Free for students.
            </p>
            <div className="hp-actions hp-rise">
              <Link to={cta} preload="intent" className="hp-button">
                {ctaLabel}
              </Link>
              {!isLoggedIn && (
                <Link to="/auth" preload="intent" className="hp-link">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="hp-screens hp-rise" aria-label="The app">
          <div className="hp-tabs" role="tablist" aria-label="Screens">
            {SCREENS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`hp-tab-${item.id}`}
                aria-controls="hp-screen-panel"
                aria-selected={index === screen}
                onClick={() => setScreen(index)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <figure
            className="hp-screens__stage"
            id="hp-screen-panel"
            role="tabpanel"
            aria-labelledby={`hp-tab-${SCREENS[screen].id}`}
          >
            <div className="hp-screens__frame">
              {SCREENS.map((item, index) => (
                <div
                  key={item.id}
                  className={"hp-screens__shot" + (index === screen ? " is-shown" : "")}
                  aria-hidden={index !== screen}
                >
                  <Shot id={item.id} alt={item.alt} eager={index === 0} />
                </div>
              ))}
            </div>
            <figcaption key={screen}>{SCREENS[screen].caption}</figcaption>
          </figure>
        </section>

        <section className="hp-statement" aria-label="Why CanvasPro">
          <p data-breathe>
            Canvas tells you everything.{" "}
            <span className="hp-quiet">CanvasPro tells you what&rsquo;s next.</span>
          </p>
        </section>

        <section className="hp-split" aria-labelledby="hp-sort-title">
          <div className="hp-split__text" data-breathe>
            <h2 id="hp-sort-title">Sorted by what comes first</h2>
            <p>
              Canvas lists work course by course. CanvasPro looks at due dates, points and how long
              each assignment takes, then puts the next thing to do at the top.
            </p>
            <p className="hp-muted">Check off the top task to see the next one move up.</p>
          </div>
          <div data-breathe style={{ "--d": "0.12s" } as CSSProperties}>
            <SortingWeek />
          </div>
        </section>

        <section className="hp-split" aria-labelledby="hp-more-title">
          <div className="hp-split__text" data-breathe>
            <h2 id="hp-more-title">Also in CanvasPro</h2>
          </div>
          <dl className="hp-more" data-breathe style={{ "--d": "0.12s" } as CSSProperties}>
            {MORE.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="hp-split" aria-labelledby="hp-setup-title">
          <div className="hp-split__text" data-breathe>
            <h2 id="hp-setup-title">Set up in a few minutes</h2>
          </div>
          <div className="hp-setup" data-breathe style={{ "--d": "0.12s" } as CSSProperties}>
            <p>
              Make a free account. In Canvas, open Account, then Settings, and create a new access
              token. Paste it into CanvasPro, and your classes, grades and deadlines show up right
              away.
            </p>
            <p className="hp-muted">
              You never type your school password into CanvasPro. The token only lets it read your
              courses, and you can revoke it in Canvas at any time.
            </p>
          </div>
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
            <span className="hp-muted">Free for students. No card needed.</span>
          </div>
        </section>
      </main>
      <HomeFooter />
    </div>
  );
}
