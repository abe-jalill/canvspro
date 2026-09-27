import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  LockKeyhole,
  Menu,
  Sparkles,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CanvasPro — Make room for what matters" },
      {
        name: "description",
        content:
          "Turn your Canvas classes, assignments, grades, and deadlines into one clear plan. CanvasPro is free for students.",
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
            "A student dashboard for Canvas LMS with assignments, grades, schedules, and a daily plan.",
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
      "You can manage or cancel it from Billing after signing in. CanvasPro access remains free after cancellation.",
  },
];

function useStoryMotion() {
  const sequenceRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    let frame = 0;
    const parallax = document.querySelectorAll<HTMLElement>(".cp-story [data-parallax]");
    const update = () => {
      frame = 0;
      const sequence = sequenceRef.current;
      const stage = stageRef.current;
      const hero = heroRef.current;
      if (hero) {
        const progress = Math.min(
          1,
          Math.max(0, -hero.getBoundingClientRect().top / Math.max(hero.offsetHeight, 1)),
        );
        hero.style.setProperty("--hero-scroll", progress.toFixed(3));
      }
      parallax.forEach((element) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
        const depth = Number(element.dataset.parallax) || 20;
        const progress = (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height);
        const shift = (progress - 0.5) * depth * (window.innerWidth <= 760 ? 0.5 : 1);
        element.style.setProperty("--parallax-y", shift.toFixed(1) + "px");
      });
      if (!sequence || !stage) return;
      const rect = sequence.getBoundingClientRect();
      if (rect.top > window.innerHeight || rect.bottom < 0) return;
      const distance = Math.max(1, sequence.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      const tidy = Math.min(1, Math.max(0, (progress - 0.19) / 0.53));
      const eased = tidy * tidy * (3 - 2 * tidy);
      const chaos = 1 - Math.min(1, Math.max(0, (progress - 0.31) / 0.12));
      const clarity = Math.min(1, Math.max(0, (progress - 0.52) / 0.16));
      stage.style.setProperty("--story-tidy", eased.toFixed(3));
      stage.style.setProperty("--story-chaos", chaos.toFixed(3));
      stage.style.setProperty("--story-clarity", clarity.toFixed(3));
      stage.style.setProperty("--story-progress", progress.toFixed(3));
      const positions =
        window.innerWidth <= 760
          ? [
              [-25, -28, -7],
              [27, -9, 6],
              [-25, 12, -5],
              [22, 28, 5],
            ]
          : [
              [-90, -82, -13],
              [120, -42, 11],
              [-115, 83, -8],
              [110, 138, 9],
            ];
      stage.querySelectorAll<HTMLElement>("[data-scatter-card]").forEach((card, index) => {
        const [x, y, rotation] = positions[index];
        const remaining = 1 - eased;
        card.style.transform =
          "translate3d(" +
          (x * remaining).toFixed(1) +
          "px," +
          (y * remaining).toFixed(1) +
          "px,0) rotate(" +
          (rotation * remaining).toFixed(1) +
          "deg)";
      });
    };
    const request = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return { sequenceRef, stageRef, heroRef };
}

function useReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".cp-story");
    const elements = root?.querySelectorAll<HTMLElement>("[data-reveal]") ?? [];
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
  const { sequenceRef, stageRef, heroRef } = useStoryMotion();
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
    Math.ceil(((Number(targetGrade) - 88.4 * 0.75) / 0.25) * 10) / 10,
  );

  return (
    <div className="cp-story">
      <a className="cp-skip" href="#main-story">
        Skip to content
      </a>
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
          <Link to="/canvas-grade-calculator" onClick={() => setMenuOpen(false)}>
            Grade calculator
          </Link>
          <Link
            to={isLoggedIn ? "/dashboard" : "/auth"}
            className="cp-nav__mobile-signin"
            onClick={() => setMenuOpen(false)}
          >
            {isLoggedIn ? "Dashboard" : "Sign in"}
          </Link>
        </nav>
        <div className="cp-nav__actions">
          <Link to={isLoggedIn ? "/dashboard" : "/auth"} className="cp-nav__signin">
            {isLoggedIn ? "Dashboard" : "Sign in"}
          </Link>
          <Link to={cta} className="cp-button cp-button--nav">
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
            A clearer day
            <br />
            starts <em>here.</em>
          </h1>
          <p className="cp-hero__intro">
            Every class. Every deadline. One place to see what matters and move forward.
          </p>
          <div className="cp-hero__actions">
            <Link to={cta} className="cp-button cp-button--light">
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

        <section className="cp-plan" aria-labelledby="cp-plan-title">
          <div className="cp-plan__topline">
            <span>03 / YOUR NEXT MOVE</span>
            <span>LESS GUESSING. MORE DOING.</span>
          </div>
          <div className="cp-plan__layout">
            <div className="cp-plan__copy" data-reveal>
              <span className="cp-kicker cp-kicker--dark">GET IT DONE</span>
              <h2 id="cp-plan-title">
                A plan that
                <br />
                feels <em>possible.</em>
              </h2>
              <p>
                Start with one recommended assignment. Then follow a realistic plan for the rest of
                today, with time estimates and room to adjust.
              </p>
              <Link to={cta} className="cp-inline-link">
                See what to do next <ArrowRight size={18} />
              </Link>
            </div>
            <div className="cp-plan__visual" data-reveal>
              <div className="cp-plan__orbit cp-plan__orbit--one" aria-hidden="true">
                FOCUS
              </div>
              <div className="cp-plan__orbit cp-plan__orbit--two" aria-hidden="true">
                <Sparkles size={18} />
              </div>
              <div className="cp-product-panel cp-product-panel--plan" data-parallax="42">
                <div className="cp-product-panel__chrome">
                  <Brand dark />
                  <span>
                    GET IT DONE <span className="cp-live-dot" />
                  </span>
                </div>
                <div className="cp-product-panel__content">
                  <div className="cp-panel-label">WHAT SHOULD I DO NOW?</div>
                  <h3>Start with Physics Homework.</h3>
                  <p>Due tonight · highest priority · about 30 min</p>
                  <div className="cp-panel-primary">
                    Start now <ArrowRight size={15} />
                  </div>
                  <div className="cp-panel-rule" />
                  <div className="cp-panel-heading">
                    <strong>Today’s plan</strong>
                    <span>1 hr 40 min total</span>
                  </div>
                  {[
                    ["01", "Physics Homework", "30 min", "Tonight"],
                    ["02", "CAD Assignment", "45 min", "Tomorrow"],
                    ["03", "English Reading", "25 min", "Friday"],
                  ].map(([number, title, duration, due]) => (
                    <div className="cp-plan-row" key={number}>
                      <span>{number}</span>
                      <div>
                        <strong>{title}</strong>
                        <small>{due}</small>
                      </div>
                      <em>{duration}</em>
                    </div>
                  ))}
                  <div className="cp-panel-progress">
                    <span>0 OF 3 COMPLETE</span>
                    <span>0%</span>
                    <div>
                      <i />
                    </div>
                  </div>
                </div>
              </div>
              <div className="cp-plan__side-note" aria-hidden="true">
                NOT A PERFECT DAY.
                <br />A STARTABLE ONE.
              </div>
            </div>
          </div>
        </section>

        <section className="cp-workspace" aria-labelledby="cp-workspace-title">
          <div className="cp-workspace__intro" data-reveal>
            <span className="cp-kicker">04 / THE WHOLE PICTURE</span>
            <h2 id="cp-workspace-title">
              Clarity is a<br />
              <em>powerful feeling.</em>
            </h2>
            <p>
              See how your courses, deadlines, and grades connect. The dashboard stays useful when
              the semester gets complicated.
            </p>
          </div>
          <div className="cp-workspace__stage" data-reveal>
            <div className="cp-workspace__rail">
              <span className="cp-workspace__rail-title">
                <Brand />
              </span>
              <div className="cp-workspace__rail-icons">
                <span>◧</span>
                <CalendarDays size={18} />
                <CheckCircle2 size={18} />
                <GraduationCap size={18} />
              </div>
              <span className="cp-workspace__rail-bottom">CP</span>
            </div>
            <div className="cp-workspace__window">
              <div className="cp-workspace__window-head">
                <div>
                  <small>YOUR SPACE</small>
                  <strong>{view === "week" ? "A week in view." : "Every grade, in view."}</strong>
                </div>
                <span className="cp-sync">
                  <span /> CANVAS SYNCED
                </span>
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
                <div className="cp-week" role="tabpanel">
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
                    <div className="cp-week__assignment cp-week__assignment--purple">
                      <span>09:00</span>
                      <div>
                        <strong>Physics problem set</strong>
                        <small>Physics II · 30 min</small>
                      </div>
                      <Check size={16} />
                    </div>
                    <div className="cp-week__assignment cp-week__assignment--mint">
                      <span>11:30</span>
                      <div>
                        <strong>CAD assignment</strong>
                        <small>Engineering Design · 45 min</small>
                      </div>
                      <Check size={16} />
                    </div>
                    <div className="cp-week__assignment cp-week__assignment--peach">
                      <span>15:00</span>
                      <div>
                        <strong>Reading response</strong>
                        <small>Modern Texts · 25 min</small>
                      </div>
                      <Check size={16} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cp-grades" role="tabpanel">
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
            <div
              className="cp-workspace__float cp-workspace__float--grade"
              data-parallax="52"
              aria-hidden="true"
            >
              <span>CALCULUS III</span>
              <strong>88.7%</strong>
              <small>Current grade</small>
            </div>
            <div className="cp-workspace__float cp-workspace__float--notice" aria-hidden="true">
              <Bell size={17} />
              <div>
                <strong>Heads up</strong>
                <span>Physics is due tonight.</span>
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

        <section className="cp-calculator" aria-labelledby="cp-calculator-title">
          <div className="cp-calculator__visual" data-reveal>
            <div className="cp-calculator__ring" aria-hidden="true">
              <span>
                88.4<small>%</small>
              </span>
            </div>
            <div className="cp-calculator__card" data-parallax="36">
              <span>FINAL GRADE PREDICTOR</span>
              <strong>{finalNeeded > 100 ? "Over 100%" : finalNeeded.toFixed(1) + "%"}</strong>
              <small>needed on your final exam</small>
            </div>
          </div>
          <div className="cp-calculator__copy" data-reveal>
            <span className="cp-kicker cp-kicker--dark">05 / KNOW WHERE YOU STAND</span>
            <h2 id="cp-calculator-title">
              No more
              <br />
              <em>grade guessing.</em>
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
              Example: 88.4% current grade, final worth 25%.
            </small>
            <Link to="/canvas-grade-calculator" className="cp-inline-link">
              Open the full grade calculator <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="cp-steps" id="how-it-works" aria-labelledby="cp-steps-title">
          <div className="cp-steps__heading" data-reveal>
            <span className="cp-kicker">06 / BEGIN SIMPLY</span>
            <h2 id="cp-steps-title">
              Three small steps.
              <br />
              <em>A lot more breathing room.</em>
            </h2>
          </div>
          <div className="cp-steps__list">
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

        <section className="cp-questions" id="questions" aria-labelledby="cp-questions-title">
          <div className="cp-questions__intro" data-reveal>
            <span className="cp-kicker cp-kicker--dark">GOOD TO KNOW</span>
            <h2 id="cp-questions-title">
              A few things
              <br />
              you might <em>wonder.</em>
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

        <section className="cp-finale" aria-labelledby="cp-finale-title">
          <div className="cp-finale__glow" aria-hidden="true" />
          <div className="cp-finale__content" data-reveal>
            <span className="cp-kicker">YOUR NEXT CHAPTER STARTS HERE</span>
            <h2 id="cp-finale-title">
              Less looking.
              <br />
              More <em>living.</em>
            </h2>
            <p>A place for your coursework to make sense. Free for every student.</p>
            <Link to={cta} className="cp-button cp-button--light">
              {isLoggedIn ? "Open your dashboard" : "Get started for free"} <ArrowRight size={18} />
            </Link>
            <span className="cp-finale__fineprint">
              NO SUBSCRIPTION. NO CREDIT CARD. JUST A CLEARER DAY.
            </span>
          </div>
          <div className="cp-finale__orb" data-parallax="45" aria-hidden="true">
            <Brand />
          </div>
        </section>
      </main>
    </div>
  );
}
