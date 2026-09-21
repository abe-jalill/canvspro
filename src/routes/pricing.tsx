import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { CANVAS_PRO_PRICE_LABEL, CANVAS_PRO_YEARLY_BADGE } from "@/lib/stripe";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — First 10 days free, then $2.99/month or $30/year" },
      {
        name: "description",
        content:
          "First 10 days free, then Canvas Pro is $2.99 per month or $30 per year (save 17%): live Canvas grades, assignments, announcements, focus windows, calendar, and smart notifications. Cancel anytime.",
      },
      { property: "og:title", content: "Pricing — First 10 days free, then $2.99/month or $30/year" },
      {
        property: "og:description",
        content:
          "Start with 10 days free, then $2.99 per month or $30 per year (save 17%). Cancel anytime.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const FREE_FEATURES = ["Dashboard overview", "Class nicknames", "Light and dark themes"];

const PRO_FEATURES = [
  "Live Canvas grades, assignments, and announcements",
  "Focus view with 1-day to 1-week due windows",
  "Calendar, class schedule, and workload heatmap",
  "Smart notifications and daily digest",
  "Syllabus links and .ics assignment export",
];

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Canvas Pro
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple pricing, one plan
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Your first 10 days of Pro are free. After that it's {CANVAS_PRO_PRICE_LABEL} — or
          $30/year ({CANVAS_PRO_YEARLY_BADGE}). Cancel anytime from the billing portal.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <section className="glass-panel-strong flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Free</h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight">$0</p>
          </div>
          <FeatureList items={FREE_FEATURES} />
          <Link
            to="/signup"
            className="glass-hover glass-inset mt-auto inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
          >
            Create an account
          </Link>
        </section>

        <section className="glass-panel-strong relative flex flex-col gap-4 p-6">
          <span className="absolute -top-3 right-6 rounded-full bg-emerald-500 px-3 py-0.5 text-[11px] font-semibold text-white">
            {CANVAS_PRO_YEARLY_BADGE}
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Pro</h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              $2.99
              <span className="text-sm font-normal text-muted-foreground"> / month</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or{" "}
              <span className="font-semibold text-foreground">$30 / year</span> —{" "}
              {CANVAS_PRO_YEARLY_BADGE}
            </p>
          </div>
          <FeatureList items={PRO_FEATURES} />
          <Link
            to="/billing"
            className="glass-hover mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            Start 10 days free
          </Link>
          <p className="text-xs text-muted-foreground">
            First 10 days free, then you're charged automatically. Sign in first — checkout opens
            securely on the billing page, where you pick monthly or yearly.
          </p>
        </section>
      </div>
    </div>
  );
}
