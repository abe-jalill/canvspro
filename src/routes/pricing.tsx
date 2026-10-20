import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PLANS, TRIAL_DAYS } from "@/lib/billing";
import { PublicPage, PublicPageHeader } from "@/components/public-page";

const TITLE = "CoursePro Pricing";
const DESCRIPTION = `Paid plans are coming soon: ${PLANS.monthly.price}/month or ${PLANS.yearly.price}/year, with a ${TRIAL_DAYS}-day free trial.`;

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
  "Daily streaks, with a streak freeze every month",
  "Grade history for every class",
  "Connect Claude, ChatGPT or another AI assistant to your Canvas",
];

function PricingPage() {
  return (
    <PublicPage>
      <PublicPageHeader eyebrow="Pricing" title="One simple plan. Coming soon.">
        <p>
          Paid plans aren&rsquo;t open yet. Until they are, every part of CoursePro is free to use.
        </p>
      </PublicPageHeader>

      <div className="hp-plans">
        {(["monthly", "yearly"] as const).map((plan) => (
          <section key={plan} className="hp-card hp-plan" aria-labelledby={`plan-${plan}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id={`plan-${plan}`} className="hp-eyebrow">
                {plan === "monthly" ? "Monthly" : "Yearly"}
              </h2>
              <span className="hp-badge">Coming soon</span>
            </div>
            <p className="hp-plan__price">
              {PLANS[plan].price}
              <span>/{PLANS[plan].per}</span>
            </p>
            <p className="hp-plan__note">
              {plan === "yearly" ? "Billed yearly." : "Billed monthly."}{" "}
              {TRIAL_DAYS}-day free trial. Cancel anytime.
            </p>
            <div className="hp-plan__spacer" />
            <button type="button" className="hp-button" disabled aria-disabled="true">
              Coming soon
            </button>
          </section>
        ))}
      </div>

      <section className="hp-section hp-card" aria-labelledby="included-title">
        <h2 id="included-title">Everything is included</h2>
        <ul className="hp-checks">
          {INCLUDED.map((item) => (
            <li key={item}>
              <Check aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </PublicPage>
  );
}
