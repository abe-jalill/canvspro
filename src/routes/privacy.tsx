import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Canvas Pro" },
      {
        name: "description",
        content:
          "Canvas Pro's Privacy Policy explains what data we collect, how we use it, and your rights.",
      },
      { property: "og:title", content: "Privacy Policy — Canvas Pro" },
      {
        property: "og:description",
        content:
          "Canvas Pro's Privacy Policy explains what data we collect, how we use it, and your rights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Last updated: August 15, 2026
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Canvas Pro is built to give you a clear, personal view of your own
          Canvas LMS data. This policy explains what we collect, how we use it,
          and how you can manage your information.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">What we collect</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Account information.</strong>{" "}
              When you create an account, we store your email address and a
              secure authentication record. If you sign in with Google or
              Apple, we receive the name, email, and profile information you
              choose to share with us through that provider.
            </p>
            <p>
              <strong className="text-foreground">Canvas API key.</strong>{" "}
              You may enter your Canvas API key in Settings so Canvas Pro can
              fetch your Canvas data on your behalf. This key is stored
              encrypted and is used only to call Canvas's API for your own
              account. It is never shared with other users, advertisers, or
              third parties.
            </p>
            <p>
              <strong className="text-foreground">Canvas data.</strong> With
              your key, we fetch your courses, assignments, grades,
              announcements, and schedule/calendar events from Canvas. This data
              is shown only to you inside your dashboard.
            </p>
            <p>
              <strong className="text-foreground">Notification tokens.</strong>{" "}
              If you enable push or browser notifications, we store the device
              token needed to deliver assignment, grade, and announcement alerts
              to you.
            </p>
            <p>
              <strong className="text-foreground">Usage data.</strong> We may
              collect basic error and performance data to keep the app running
              smoothly. This does not include your Canvas data.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">
            How we use your data
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            We use your information only to provide the Canvas Pro dashboard to
            you: displaying your schedule, assignments, grades, and
            announcements; sending the notifications you opt into; and keeping
            your account secure. We do not sell your data or use it for
            advertising.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">
            Payment information
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            If billing is added in the future (for example, a paid subscription
            tier), payment details will be processed by Stripe. Canvas Pro does
            not store your full payment card information directly. Stripe's
            privacy policy will apply to payment data.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">
            Data retention and deletion
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            We keep your data while your account is active. If you delete your
            account, your Canvas API key, stored Canvas data, notification
            tokens, and custom settings are removed. You can request account or
            data deletion through the Settings page, or by emailing us at the
            address below.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Your rights</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            You can update or remove your Canvas API key at any time in Settings.
            You can also request a copy of your data, correct inaccuracies, or
            delete your account by contacting us at{" "}
            <a
              href="mailto:[YOUR_EMAIL]"
              className="font-medium text-foreground underline underline-offset-4"
            >
              [YOUR_EMAIL]
            </a>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Contact us</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Questions about this policy or how we handle your data? Reach out at{" "}
            <a
              href="mailto:[YOUR_EMAIL]"
              className="font-medium text-foreground underline underline-offset-4"
            >
              [YOUR_EMAIL]
            </a>
            .
          </p>
        </section>

        <div className="mt-12 border-t border-border/30 pt-6">
          <Link
            to="/"
            className="text-sm font-medium text-foreground underline underline-offset-4"
          >
            Back to Canvas Pro
          </Link>
        </div>
      </div>
    </main>
  );
}
