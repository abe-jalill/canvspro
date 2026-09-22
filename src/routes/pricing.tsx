import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — CanvasPro is free" },
      { name: "description", content: "Every CanvasPro feature is free for everyone. No subscription or credit card required." },
    ],
  }),
  component: PricingPage,
});

const FEATURES = [
  "Live Canvas grades, assignments, and announcements",
  "Focus view and study sessions",
  "Calendar, class schedule, and workload heatmap",
  "Smart notifications and daily digest",
  "Syllabus links and .ics assignment export",
];

function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">CanvasPro</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Free for everyone</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Every feature is included. No trial, subscription, or credit card required.
        </p>
      </header>
      <section className="glass-panel-strong mx-auto mt-10 flex max-w-xl flex-col gap-5 p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Everything included</h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight">$0</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Link to="/signup" className="glass-hover mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background">
          Create a free account
        </Link>
        <p className="text-xs text-muted-foreground">
          Already subscribed? You can manage or cancel an existing subscription from Billing after signing in. Your access remains free.
        </p>
      </section>
    </div>
  );
}
