import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PLANS, REFUND_WINDOW_DAYS, TRIAL_DAYS } from "@/lib/billing";
import "./public-pages.css";

const TITLE = "CoursePro Pricing";
const DESCRIPTION = `Start with a ${TRIAL_DAYS}-day free trial, then ${PLANS.monthly.price}/month or ${PLANS.yearly.price}/year. Cancel anytime.`;

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — CoursePro" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://canvaspro.app/pricing" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/pricing" }],
  }),
  component: PricingPage,
});

const INCLUDED = [
  "Every class, assignment, grade and announcement in one dashboard",
  "Due-date, grade and announcement alerts, even with the app closed",
  "Class schedule with countdowns and reminders",
  "Focus, study sessions and Today's Plan",
  "Grade history for every class",
  "Connect Claude, ChatGPT or another AI assistant to your Canvas",
];

const FAQ = [
  {
    q: "How does the free trial work?",
    a: `You add a payment method and get ${TRIAL_DAYS} days free. We email you 7 days before your first charge. Cancel before the trial ends in Settings → Billing and you're never charged.`,
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel online in Settings → Billing. You keep CoursePro until the end of the period you've paid for, and you won't be charged again.",
  },
  {
    q: "Can I switch from monthly to yearly?",
    a: "Anytime, in Settings → Billing. The unused part of your month is credited, and you see the exact amount before you confirm.",
  },
  {
    q: "What if I change my mind after paying?",
    a: `Ask for a refund within ${REFUND_WINDOW_DAYS} days of a charge, for any reason. See the Refund Policy.`,
  },
  {
    q: "Who processes the payment?",
    a: "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders, and it handles payments, taxes, receipts and refunds.",
  },
];

function PricingPage() {
  return (
    <article className="cp-public-tool mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="text-center">
        <Link to="/" className="cp-public-tool__back">
          ← CoursePro
        </Link>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Pricing
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {TRIAL_DAYS} days free. Then one simple plan.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">{DESCRIPTION}</p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {(["monthly", "yearly"] as const).map((plan) => (
          <section key={plan} className="glass-panel flex flex-col p-6">
            <h2 className="text-sm font-medium">{plan === "monthly" ? "Monthly" : "Yearly"}</h2>
            <p className="mt-2 text-4xl font-semibold tracking-tight">
              {PLANS[plan].price}
              <span className="text-base font-normal text-muted-foreground">
                /{PLANS[plan].per}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {plan === "yearly" ? "2 months free · billed once a year" : "Billed every month"} ·
              plus applicable tax
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Free for {TRIAL_DAYS} days, then {PLANS[plan].price}/{PLANS[plan].per}, renewing
              automatically until you cancel.
            </p>
            <Link
              to="/signup"
              className="glass-hover mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
            >
              Start your {TRIAL_DAYS}-day free trial
            </Link>
          </section>
        ))}
      </div>

      <section className="glass-panel mt-6 p-6">
        <h2 className="text-lg font-semibold tracking-tight">Everything is included</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {INCLUDED.map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="px-1 text-lg font-semibold tracking-tight">Questions</h2>
        {FAQ.map(({ q, a }) => (
          <div key={q} className="glass-panel p-5">
            <h3 className="text-sm font-medium">{q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </div>
        ))}
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link to="/terms" className="underline underline-offset-4">
          Terms of Use
        </Link>{" "}
        ·{" "}
        <Link to="/refund-policy" className="underline underline-offset-4">
          Refund Policy
        </Link>{" "}
        ·{" "}
        <Link to="/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
      </p>
    </article>
  );
}
