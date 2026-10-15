import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PublicPage, PublicPageHeader } from "@/components/public-page";

const SUPPORT_EMAIL = "support@canvaspro.app";
const REPORT_FORM = "https://forms.gle/7bttezmTW3ji3zFU9";
const DESCRIPTION =
  "Get help with CoursePro: connecting Canvas, notifications, streaks and your account. Email support@canvaspro.app.";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — CoursePro" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "CoursePro Support" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://canvaspro.app/support" },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/support" }],
  }),
  component: SupportPage,
});

const QUESTIONS: { question: string; answer: ReactNode }[] = [
  {
    question: "How do I connect my Canvas account?",
    answer: (
      <>
        <p>
          In CoursePro, open Settings, then Canvas. Enter your school&rsquo;s Canvas address (for
          example yourschool.instructure.com) and a Canvas access token.
        </p>
        <p>
          To make a token, sign in to Canvas, open Account, then Settings. Under Approved
          Integrations, choose New Access Token, give it a name, and copy the token into CoursePro.
          You never enter your school password.
        </p>
      </>
    ),
  },
  {
    question: "CoursePro can't connect to my school. What now?",
    answer: (
      <p>
        Check that the address is the one you use to open Canvas, and that the token was copied in
        full. If it still won&rsquo;t connect, email us your school&rsquo;s Canvas address and
        we&rsquo;ll look into it.
      </p>
    ),
  },
  {
    question: "My notifications aren't arriving.",
    answer: (
      <>
        <p>
          Open Settings, then Notifications. Make sure Notifications is on and this device says it
          gets notifications even with CoursePro closed, then press Send test.
        </p>
        <p>
          If the test doesn&rsquo;t arrive, allow notifications for canvaspro.app in your browser or
          phone settings. On iPhone, add CoursePro to your Home Screen first (Share, then Add to
          Home Screen), then turn notifications on from there. Quiet at night also pauses
          notifications overnight.
        </p>
      </>
    ),
  },
  {
    question: "How do streaks work?",
    answer: (
      <>
        <p>
          Open CoursePro on a day and that day counts. Come back the next day and your streak grows.
        </p>
        <p>
          Miss a day and your streak freeze covers it automatically, once each month. At 6 PM, if
          you haven&rsquo;t opened CoursePro yet that day, we&rsquo;ll remind you. You can turn that
          reminder off in Settings, then Notifications.
        </p>
      </>
    ),
  },
  {
    question: "Does CoursePro see my school password or change anything in Canvas?",
    answer: (
      <p>
        No. CoursePro only reads your courses, assignments, grades and announcements using the token
        you created, and never asks for your school password. You can revoke the token in Canvas at
        any time.
      </p>
    ),
  },
  {
    question: "How do I delete my account?",
    answer: (
      <p>
        Open Settings, then Account, and choose Delete account. Your account and the data stored
        with it are removed permanently. If you can&rsquo;t sign in, email us from the address on
        your account and we&rsquo;ll delete it for you.
      </p>
    ),
  },
  {
    question: "Is CoursePro part of Canvas?",
    answer: (
      <p>
        No. CoursePro is an independent app and isn&rsquo;t affiliated with, endorsed by or
        sponsored by Instructure, Inc. or Canvas LMS.
      </p>
    ),
  },
];

function SupportPage() {
  return (
    <PublicPage>
      <PublicPageHeader eyebrow="Support" title="How can we help?">
        <p>
          Find a quick answer below, or email us and a real person will reply, usually within one to
          two business days.
        </p>
      </PublicPageHeader>

      <section className="hp-section hp-card hp-contact" aria-labelledby="contact-title">
        <div>
          <h2 id="contact-title">Contact us</h2>
          <p className="hp-muted">
            <a className="hp-link" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
        <div className="hp-contact__actions">
          <a className="hp-button" href={`mailto:${SUPPORT_EMAIL}?subject=CoursePro%20help`}>
            Email support
          </a>
          <a
            className="hp-button hp-button--quiet"
            href={REPORT_FORM}
            target="_blank"
            rel="noopener noreferrer"
          >
            Report a problem
          </a>
        </div>
      </section>

      <section className="hp-section" aria-labelledby="questions-title">
        <h2 id="questions-title">Common questions</h2>
        <Accordion type="single" collapsible className="hp-faq">
          {QUESTIONS.map((item, index) => (
            <AccordionItem key={item.question} value={`q-${index}`} className="hp-faq__item">
              <AccordionTrigger className="hp-faq__q">{item.question}</AccordionTrigger>
              <AccordionContent className="hp-faq__a">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="hp-section" aria-labelledby="policies-title">
        <h2 id="policies-title">Policies</h2>
        <nav aria-label="Policies" className="hp-doc-nav">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Use</Link>
          <Link to="/refund-policy">Refund Policy</Link>
        </nav>
      </section>
    </PublicPage>
  );
}
