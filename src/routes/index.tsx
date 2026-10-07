import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  GraduationCap,
  ListChecks,
  LockKeyhole,
  Megaphone,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import "./home.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CanvasPro — Make room for what matters" },
      {
        name: "description",
        content:
          "Turn Canvas classes, assignments, grades, and deadlines into one clear plan. See what's next, plan the week, and study one thing at a time. Free for students.",
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
    links: [
      { rel: "canonical", href: "https://canvaspro.app/" },
      // The first screen shows immediately; fetch it before anything else.
      {
        rel: "preload",
        as: "image",
        href: "/home/dashboard-light.webp",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "preload",
        as: "image",
        href: "/home/dashboard-dark.webp",
        media: "(prefers-color-scheme: dark)",
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

/** The screens the story walks through, in order. Screenshots live in /public/home. */
const SCREENS = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "canvaspro.app/dashboard",
    kicker: "01 · Dashboard",
    title: "Your whole day, at a glance.",
    body: "Grades, what to do next, and everything due in the next 24 hours, the moment you open it.",
    alt: "The CanvasPro dashboard with a greeting, the next assignment up, and class grades.",
  },
  {
    id: "coming-up",
    label: "Coming up",
    path: "canvaspro.app/focus",
    kicker: "02 · Coming up",
    title: "See the week before it sees you.",
    body: "Every deadline from every class, one day at a time, with how long each one should take.",
    alt: "The Coming Up page with a seven-day strip and assignments grouped by day.",
  },
  {
    id: "study",
    label: "Study session",
    path: "canvaspro.app/study-session",
    kicker: "03 · Study session",
    title: "Pick the work. Set the time. Begin.",
    body: "Choose your assignments, then a total time, time for each one, or Pomodoro. CanvasPro keeps your place.",
    alt: "The Study Session page: pick assignments on the left, your session and its time on the right.",
  },
  {
    id: "assignments",
    label: "Assignments",
    path: "canvaspro.app/assignments",
    kicker: "04 · Assignments",
    title: "Nothing slips through.",
    body: "One list for every class, ordered so the right thing is always on top.",
    alt: "The Assignments page with a weekly count and a ranked list of work.",
  },
] as const;

const FLOW = [
  "Weighted Next up",
  "Assignment progress",
  "Per-assignment timers",
  "Pomodoro",
  "Coming up, by day",
  "Workload heatmap",
  "GPA",
  "What-if grades",
  "Announcements",
  "Deadline reminders",
  "Class nicknames",
  "Class schedule",
  "Custom dashboard",
  "Get It Done plan",
  "Calendar",
  "Light and dark",
];

const FEATURES = [
  {
    icon: GraduationCap,
    title: "Grades and GPA",
    body: "Every class grade in one place, your GPA, and a what-if calculator for the final.",
  },
  {
    icon: CalendarDays,
    title: "Calendar and workload",
    body: "See the busy days coming and spread the work out before they arrive.",
  },
  {
    icon: Megaphone,
    title: "Announcements",
    body: "New posts from every class, without opening each course.",
  },
  {
    icon: BellRing,
    title: "Reminders",
    body: "A gentle nudge before things are due, even when CanvasPro is closed.",
  },
  {
    icon: ListChecks,
    title: "Get It Done",
    body: "A short plan for today, built from what's due and how long it takes.",
  },
  {
    icon: Smartphone,
    title: "Every screen",
    body: "Laptop or phone, light or dark. It feels the same everywhere.",
  },
];

const STATEMENT =
  "CanvasPro reads your Canvas, sorts what matters, and hands you one clear next step, so the rest of your day can breathe.".split(
    " ",
  );
const STATEMENT_ACCENT = new Set(["one", "clear", "next", "step,"]);

const faq = [
  {
    question: "What does CanvasPro bring together?",
    answer:
      "Your Canvas courses, assignments, grades, announcements, and deadlines appear in one place, with a clear next step.",
  },
  {
    question: "Is CanvasPro free?",
    answer:
      "Yes. 100% free, no payment method required.",
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

/** A heading split into lines that rise one after another when it scrolls into view. */
function Lines({ lines }: { lines: ReactNode[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <span className="hm-line" key={index} style={{ "--line": index } as CSSProperties}>
          <span>{line}</span>
        </span>
      ))}
    </>
  );
}

function Screenshot({ id, alt, eager }: { id: string; alt: string; eager?: boolean }) {
  return (
    <picture>
      <source srcSet={`/home/${id}-dark.webp`} media="(prefers-color-scheme: dark)" />
      <img
        src={`/home/${id}-light.webp`}
        alt={alt}
        width={1600}
        height={1000}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}

function Laptop({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="hm-laptop">
      <div className="hm-laptop__lid">
        <div className="hm-laptop__bar" aria-hidden="true">
          <span className="hm-laptop__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="hm-laptop__url" data-url>
            {path}
          </span>
        </div>
        <div className="hm-laptop__screen">{children}</div>
      </div>
      <div className="hm-laptop__base" aria-hidden="true" />
    </div>
  );
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

/**
 * Everything that moves with the page. Scroll and pointer set a target; the
 * screen glides toward it each frame, so motion stays fluid instead of
 * jumping with every wheel step. Each screen holds still for a while before
 * the next one slides up into the laptop.
 */
function useHomeMotion(onStep: (index: number) => void) {
  const rootRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLParagraphElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const story = storyRef.current;
    const stage = stageRef.current;
    if (!root || !story || !stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shots = Array.from(stage.querySelectorAll<HTMLElement>(".hm-shot"));
    const url = stage.querySelector<HTMLElement>("[data-url]");
    const panels = Array.from(story.querySelectorAll<HTMLElement>(".hm-copy__panel"));
    const tabs = Array.from(story.querySelectorAll<HTMLElement>(".hm-steps-nav button"));
    const words = Array.from(statementRef.current?.querySelectorAll<HTMLElement>("span") ?? []);
    const last = SCREENS.length - 1;

    let frame = 0;
    let shown = -1;
    let current = 0;
    let target = 0;
    let raw = 0;

    const measure = () => {
      const vh = window.innerHeight;
      const rect = story.getBoundingClientRect();
      const travel = Math.max(1, rect.height - (vh - 64));
      raw = clamp((64 - rect.top) / travel) * last;
      if (reduce.matches) {
        target = Math.round(raw);
      } else {
        const segment = Math.min(last - 1, Math.floor(raw));
        target = raw >= last ? last : segment + smooth((raw - segment - 0.3) / 0.4);
      }
    };

    const render = () => {
      frame = 0;
      measure();
      const vh = window.innerHeight;
      const doc = document.documentElement;
      root.style.setProperty(
        "--hm-read",
        clamp(window.scrollY / Math.max(1, doc.scrollHeight - vh)).toFixed(4),
      );

      // Glide toward the target so the slide stays smooth.
      current += (target - current) * (reduce.matches ? 1 : 0.14);
      if (Math.abs(target - current) < 0.0005) current = target;
      const p = current;

      shots.forEach((shot, index) => {
        shot.style.setProperty("--hm-offset", clamp(index - p, -1, 1).toFixed(4));
      });
      panels.forEach((panel, index) => {
        const distance = index - p;
        panel.style.setProperty("--hm-show", (1 - clamp(Math.abs(distance) * 1.7)).toFixed(3));
        panel.style.setProperty("--hm-shift", (distance * 40).toFixed(1));
        panel.classList.toggle("is-active", Math.round(p) === index);
      });

      const active = Math.round(p);
      tabs.forEach((tab, index) => {
        tab.style.setProperty(
          "--hm-fill",
          index === active ? clamp(raw - index + 0.5).toFixed(3) : "0",
        );
      });
      if (active !== shown) {
        shown = active;
        if (url) url.textContent = SCREENS[active].path;
        onStep(active);
      }

      // A sentence that lights up word by word.
      const statement = statementRef.current;
      if (statement && words.length) {
        const box = statement.getBoundingClientRect();
        if (box.bottom > 0 && box.top < vh) {
          const reveal = clamp((vh * 0.85 - box.top) / (box.height + vh * 0.25)) * words.length;
          words.forEach((word, index) => {
            word.style.setProperty("--hm-word", clamp(reveal - index).toFixed(3));
          });
        }
      }

      // How it works: a rail fills as you read down the steps.
      const steps = stepsRef.current;
      if (steps) {
        const box = steps.getBoundingClientRect();
        if (box.bottom > 0 && box.top < vh) {
          const line = vh * 0.6;
          steps.style.setProperty(
            "--hm-steps-fill",
            clamp((line - box.top) / box.height).toFixed(3),
          );
          steps.querySelectorAll<HTMLElement>(".hm-step").forEach((step) => {
            step.classList.toggle("is-reached", step.getBoundingClientRect().top + 24 < line);
          });
        }
      }

      if (current !== target) frame = window.requestAnimationFrame(render);
    };

    const request = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };
    measure();
    current = target;
    render();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    reduce.addEventListener("change", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      reduce.removeEventListener("change", request);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [onStep]);

  // Headings and cards rise in once, as they scroll into view.
  useEffect(() => {
    const root = rootRef.current;
    const elements = root?.querySelectorAll<HTMLElement>("[data-reveal], [data-lines]") ?? [];
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    root?.classList.add("hm--motion");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      root?.classList.remove("hm--motion");
    };
  }, []);

  return { rootRef, storyRef, stageRef, statementRef, stepsRef };
}

function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [step, setStep] = useState(0);
  const { rootRef, storyRef, stageRef, statementRef, stepsRef } = useHomeMotion(setStep);

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

  /** Scrolls to the point where a screen sits still in the laptop. */
  function goToScreen(index: number) {
    const story = storyRef.current;
    if (!story) return;
    const travel = story.offsetHeight - (window.innerHeight - 64);
    const top = story.getBoundingClientRect().top + window.scrollY - 64;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: top + (travel * index) / (SCREENS.length - 1) + 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  /** Moves the glow on a feature card to the pointer. */
  function followPointer(event: ReactPointerEvent<HTMLElement>) {
    const card = (event.target as HTMLElement).closest<HTMLElement>(".hm-feature");
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - box.left}px`);
    card.style.setProperty("--my", `${event.clientY - box.top}px`);
  }

  const ctaButtons = (
    <div className="hm-copy__actions">
      <Link to={cta} preload="intent" className="hm-button">
        {isLoggedIn ? "Open your dashboard" : "Get started free"}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
      {!isLoggedIn && (
        <Link to="/auth" preload="intent" className="hm-button hm-button--quiet">
          Sign in
        </Link>
      )}
    </div>
  );

  const copy = (screen: (typeof SCREENS)[number], index: number) => (
    <>
      <span className="hm-kicker">{screen.kicker}</span>
      {index === 0 ? <h1>{screen.title}</h1> : <h2>{screen.title}</h2>}
      <p>{screen.body}</p>
      {index === 0 && ctaButtons}
    </>
  );

  const flowRow = (items: string[], reverse = false) => (
    <div className={"hm-marquee" + (reverse ? " hm-marquee--reverse" : "")}>
      {[...items, ...items].map((item, index) => (
        <span
          className="hm-pill"
          key={index}
          aria-hidden={index >= items.length ? true : undefined}
        >
          {index % 2 ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <Sparkles size={15} aria-hidden="true" />
          )}
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div className="hm" ref={rootRef}>
      <div className="hm-aurora" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <a className="hm-skip" href="#main">
        Skip to content
      </a>
      <div className="hm-progress" aria-hidden="true">
        <span />
      </div>

      <header className="hm-nav">
        <Link to="/" className="hm-brand" aria-label="CanvasPro home">
          canvaspro<span>.</span>
        </Link>
        <nav className="hm-nav__links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#questions">Questions</a>
          <Link to="/canvas-grade-calculator" preload="intent">
            Grade calculator
          </Link>
        </nav>
        <div className="hm-nav__actions">
          <Link
            to={isLoggedIn ? "/dashboard" : "/auth"}
            preload="intent"
            className="hm-nav__signin"
          >
            {isLoggedIn ? "Dashboard" : "Sign in"}
          </Link>
          <Link to={cta} preload="intent" className="hm-button hm-button--small">
            {isLoggedIn ? "Open app" : "Get started"}
          </Link>
        </div>
      </header>

      <main id="main">
        <section
          className="hm-story"
          ref={storyRef}
          style={{ "--hm-steps": SCREENS.length } as CSSProperties}
          aria-label="A look inside CanvasPro"
        >
          <div className="hm-story__pin">
            {/* Wide screens: text on the left, one laptop whose screen slides. */}
            <div className="hm-copy">
              {SCREENS.map((screen, index) => (
                <article
                  key={screen.id}
                  className={"hm-copy__panel" + (index === 0 ? " is-active" : "")}
                  style={{ "--hm-show": index === 0 ? 1 : 0 } as CSSProperties}
                >
                  {copy(screen, index)}
                </article>
              ))}
            </div>
            <div className="hm-stage" ref={stageRef}>
              <Laptop path={SCREENS[0].path}>
                {SCREENS.map((screen, index) => (
                  <div
                    key={screen.id}
                    className="hm-shot"
                    style={{ "--hm-offset": index === 0 ? 0 : 1 } as CSSProperties}
                    aria-hidden={index !== step}
                  >
                    <Screenshot id={screen.id} alt={screen.alt} eager={index === 0} />
                  </div>
                ))}
              </Laptop>
            </div>
            <div className="hm-steps-nav" role="tablist" aria-label="Screens">
              {SCREENS.map((screen, index) => (
                <button
                  key={screen.id}
                  type="button"
                  role="tab"
                  aria-selected={index === step}
                  className={index === step ? "is-active" : undefined}
                  onClick={() => goToScreen(index)}
                >
                  {screen.label}
                </button>
              ))}
            </div>

            {/* Phones: each screen follows its own text. */}
            <div className="hm-stack">
              {SCREENS.map((screen, index) => (
                // The first screen is what visitors see first, so it never waits to fade in.
                <div key={screen.id} data-reveal={index > 0 ? true : undefined}>
                  <div className="hm-copy__panel">{copy(screen, index)}</div>
                  <Laptop path={screen.path}>
                    <div className="hm-shot">
                      <Screenshot id={screen.id} alt={screen.alt} eager={index === 0} />
                    </div>
                  </Laptop>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p className="hm-statement" id="why" ref={statementRef}>
          {STATEMENT.map((word, index) => (
            <span key={index} className={STATEMENT_ACCENT.has(word) ? "is-accent" : undefined}>
              {word}{" "}
            </span>
          ))}
        </p>

        <section className="hm-band" id="flow" aria-labelledby="hm-band-title">
          <div className="hm-band__head" data-reveal>
            <span className="hm-kicker">All of it, built in</span>
            <h2 id="hm-band-title" data-lines>
              <Lines lines={["Everything you need.", "Nothing you don't."]} />
            </h2>
            <p>Every tool works from your real Canvas data, so there's nothing to set up twice.</p>
          </div>
          <div className="hm-marquees">
            {flowRow(FLOW.slice(0, 8))}
            {flowRow(FLOW.slice(8), true)}
          </div>
        </section>

        <section className="hm-section" id="features" aria-labelledby="hm-features-title">
          <div className="hm-section__head" data-reveal>
            <span className="hm-kicker">More than four screens</span>
            <h2 id="hm-features-title" data-lines>
              <Lines lines={["The rest of your semester,", <em key="em">in its place.</em>]} />
            </h2>
          </div>
          <div className="hm-grid" onPointerMove={followPointer}>
            {FEATURES.map(({ icon: Icon, title, body }, index) => (
              <article
                key={title}
                className="hm-feature"
                data-reveal
                style={{ "--delay": index } as CSSProperties}
              >
                <span className="hm-feature__icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="hm-section" id="how-it-works" aria-labelledby="hm-steps-title">
          <div className="hm-section__head" data-reveal>
            <span className="hm-kicker">Begin simply</span>
            <h2 id="hm-steps-title" data-lines>
              <Lines lines={["Three small steps.", <em key="em">A lot more breathing room.</em>]} />
            </h2>
          </div>
          <div className="hm-steps" ref={stepsRef}>
            <span className="hm-steps__rail" aria-hidden="true">
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
                "See your classes, pick a next task, and make the day yours.",
              ],
            ].map(([number, title, detail], index) => (
              <div
                className="hm-step"
                key={number}
                data-reveal
                style={{ "--delay": index } as CSSProperties}
              >
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            ))}
          </div>
          <div className="hm-trust" data-reveal>
            <LockKeyhole size={16} aria-hidden="true" />
            <span>Your school password stays with your school.</span>
          </div>
        </section>

        <section
          className="hm-section hm-questions"
          id="questions"
          aria-labelledby="hm-questions-title"
        >
          <div className="hm-section__head" data-reveal>
            <span className="hm-kicker">Good to know</span>
            <h2 id="hm-questions-title" data-lines>
              <Lines lines={["A few things", <em key="em">you might wonder.</em>]} />
            </h2>
          </div>
          <Accordion type="single" collapsible className="hm-questions__list" data-reveal>
            {faq.map((item, index) => (
              <AccordionItem key={item.question} value={"question-" + index}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="hm-section hm-finale" aria-labelledby="hm-finale-title">
          <div className="hm-finale__glow" aria-hidden="true" />
          <span className="hm-kicker" data-reveal>
            Free for every student
          </span>
          <h2 id="hm-finale-title" data-lines>
            <Lines
              lines={[
                "Less looking.",
                <>
                  More <em>living.</em>
                </>,
              ]}
            />
          </h2>
          <p data-reveal>A place for your coursework to make sense.</p>
          <div data-reveal>
            <Link to={cta} preload="intent" className="hm-button">
              {isLoggedIn ? "Open your dashboard" : "Get started for free"}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <small data-reveal>No subscription. No credit card.</small>
        </section>
      </main>
    </div>
  );
}
