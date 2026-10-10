import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import "./welcome-tour.css";

/** What the tutorial teaches, in order. Steps with an `image` show a real screenshot. */
export const TOUR_STEPS = [
  {
    id: "dashboard",
    title: "Every class on one page",
    body: "Your grades, your announcements and everything due in the next 24 hours, pulled straight from Canvas.",
    image: "dashboard",
    alt: "The CanvasPro dashboard with a greeting, the next assignment up, and class grades.",
  },
  {
    id: "coming-up",
    title: "See the week, one day at a time",
    body: "Assignments are grouped by day with how long each should take, so nothing sneaks up on you.",
    image: "coming-up",
    alt: "The Coming Up page with a seven-day strip and assignments grouped by day.",
  },
  {
    id: "study",
    title: "Study with a plan",
    body: "Pick the assignments you want to finish, choose a timer, and start. Use a total time, time per assignment, or Pomodoro.",
    image: "study",
    alt: "The Study Session page: pick assignments on the left, your session and its time on the right.",
  },
  {
    id: "setup",
    title: "Ready in a few minutes",
    body: "Here is all it takes to get your own classes on screen.",
    image: null,
    alt: "",
  },
] as const;

const SETUP_STEPS = [
  "Create a free CanvasPro account.",
  "In Canvas, open Account, then Settings, and create a new access token.",
  "Paste the token into CanvasPro. Your classes, grades and deadlines appear right away.",
];

export function WelcomeTour({
  open,
  onClose,
}: {
  open: boolean;
  /** Called for skip, finish, Escape and every way of leaving the tour. */
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const last = TOUR_STEPS.length - 1;
  const step = TOUR_STEPS[index];

  // Always start from the first step when the tour is opened again.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal container={typeof document === "undefined" ? undefined : document.body}>
        <Dialog.Overlay className="wt-overlay" />
        <Dialog.Content
          ref={contentRef}
          className="wt"
          aria-describedby="wt-description"
          onOpenAutoFocus={(event) => {
            // Land on the main action, not on Skip.
            event.preventDefault();
            contentRef.current?.querySelector<HTMLElement>(".wt-primary")?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") setIndex((value) => Math.min(value + 1, last));
            if (event.key === "ArrowLeft") setIndex((value) => Math.max(value - 1, 0));
          }}
        >
          <div className="wt-top">
            <span className="wt-count" aria-live="polite">
              Step {index + 1} of {TOUR_STEPS.length}
            </span>
            {index < last && (
              <button type="button" className="wt-skip" onClick={onClose}>
                Skip
              </button>
            )}
          </div>

          <div className="wt-stage" key={step.id}>
            {step.image ? (
              <div className="wt-shot">
                <img
                  className="wt-shot-dark"
                  src={`/home/${step.image}-dark.webp`}
                  alt={step.alt}
                  width={1600}
                  height={1000}
                />
                <img
                  className="wt-shot-light"
                  src={`/home/${step.image}-light.webp`}
                  alt={step.alt}
                  width={1600}
                  height={1000}
                  loading="lazy"
                />
              </div>
            ) : null}

            <div className="wt-text">
              <Dialog.Title className="wt-title">{step.title}</Dialog.Title>
              <Dialog.Description id="wt-description" className="wt-body">
                {step.body}
              </Dialog.Description>

              {step.id === "setup" && (
                <>
                  <ol className="wt-list">
                    {SETUP_STEPS.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ol>
                  <p className="wt-note">
                    You never type your school password into CanvasPro. The token only lets it read
                    your courses, and you can revoke it in Canvas at any time.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="wt-bottom">
            <div className="wt-dots" aria-hidden="true">
              {TOUR_STEPS.map((item, dot) => (
                <span key={item.id} className={dot === index ? "is-on" : undefined} />
              ))}
            </div>

            <div className="wt-actions">
              {index > 0 && (
                <button
                  type="button"
                  className="wt-quiet"
                  onClick={() => setIndex((value) => value - 1)}
                >
                  Back
                </button>
              )}
              {index < last ? (
                <button
                  type="button"
                  className="wt-primary"
                  onClick={() => setIndex((value) => value + 1)}
                >
                  Next
                </button>
              ) : (
                <>
                  <Link to="/auth" className="wt-quiet" onClick={onClose}>
                    Sign in
                  </Link>
                  <Link to="/signup" className="wt-primary" onClick={onClose}>
                    Create free account
                  </Link>
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
