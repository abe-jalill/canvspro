import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Canvas Pro" },
      {
        name: "description",
        content:
          "Canvas Pro's Terms of Service describe the rules and responsibilities for using the service.",
      },
      { property: "og:title", content: "Terms of Service — Canvas Pro" },
      {
        property: "og:description",
        content:
          "Canvas Pro's Terms of Service describe the rules and responsibilities for using the service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-dvh px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Last updated: August 15, 2026
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          CanvasPro is an independent, third-party application and is not affiliated with, endorsed
          by, sponsored by, or connected in any way to Canvas LMS or Instructure, Inc. Please read
          these terms carefully before using Canvas Pro. By creating an account or using the
          service, you agree to these terms.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Description of the service</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Canvas Pro is a personal companion dashboard for the Canvas LMS. It displays your own
            Canvas data — including courses, assignments, grades, announcements, and schedule — in
            one place. You provide your Canvas API key, and Canvas Pro fetches that data on your
            behalf.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Account responsibilities</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            You must provide accurate information when creating an account. You are responsible for
            keeping your login credentials and your Canvas API key confidential. Do not share your
            account or API key with anyone else. You are responsible for activity that happens under
            your account.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Acceptable use</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Canvas Pro is for personal, non-commercial use to view your own academic data. You may
            not use it to attempt to access another user's data, abuse the Canvas API, interfere
            with the service's operation, or use it for any illegal purpose.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Disclaimers</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Independence.</strong> Canvas Pro is an
              independent tool and is not affiliated with, endorsed by, or officially connected to
              Instructure or Canvas LMS.
            </p>
            <p>
              <strong className="text-foreground">Data accuracy.</strong> The accuracy of the
              information shown in Canvas Pro depends on Canvas's own systems. Canvas Pro is not
              responsible for errors, delays, or missing information originating from Canvas.
            </p>
            <p>
              <strong className="text-foreground">Notifications.</strong> We do our best to deliver
              alerts, but we cannot guarantee that every notification will arrive on time. You
              remain responsible for tracking your own deadlines and assignments.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Subscription terms</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            CanvasPro offers a paid Pro subscription with a free 10-day trial, after which it renews
            automatically at $2.99 per month or $30 per year (save 17%). Subscriptions renew
            automatically until canceled. You can cancel anytime from the billing portal, and you
            keep access until the end of the paid period. Refunds are issued at our discretion; when
            a payment is refunded in full, Pro access ends immediately.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Limitation of liability</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Canvas Pro is provided as-is. To the extent permitted by law, we are not liable for
            service interruptions, data loss, missed notifications, or any decisions you make based
            on information shown in the dashboard. Use your official Canvas account as the final
            source of truth for grades, deadlines, and academic records.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Termination</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            We may suspend or terminate accounts that violate these terms or abuse the service. You
            may also delete your account at any time from the Settings page or by contacting us.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Governing law</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            These terms are governed by the laws of the State of Michigan, USA. Any disputes will be
            resolved in the courts located there.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Contact us</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Questions about these terms? Contact us at{" "}
            <a
              href="mailto:support@canvaspro.app"
              className="font-medium text-foreground underline underline-offset-4"
            >
              support@canvaspro.app
            </a>
            .
          </p>
        </section>

        <div className="mt-12 border-t border-border/30 pt-6">
          <Link to="/" className="text-sm font-medium text-foreground underline underline-offset-4">
            Back to Canvas Pro
          </Link>
        </div>
      </div>
    </main>
  );
}
