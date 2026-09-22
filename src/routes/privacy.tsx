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
    links: [{ rel: "canonical", href: "https://canvaspro.app/privacy" }],
  }),
  component: PrivacyPage,
});

const CONTACT_EMAIL = "support@canvaspro.app";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Last updated: September 17, 2026
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy Policy &amp; Data Use Policy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          CanvasPro is an independent, third-party application and is not
          affiliated with, endorsed by, sponsored by, or connected in any way to
          Canvas LMS or Instructure, Inc. CanvasPro is built to give you a clear,
          personal view of your own Canvas LMS data. This policy explains what we
          collect, how we use it, and how you can manage your information. By
          creating an account or providing a Canvas API key, you agree to the
          practices, limits, and disclaimers below.
        </p>

        <Section title="1. Non-affiliation with Canvas LMS / Instructure, Inc.">
          <p>
            Canvas Pro is an independent, third-party companion application created and
            operated by an independent software developer.
          </p>
          <p>
            <strong className="text-foreground">Non-affiliation.</strong> Canvas Pro is
            not affiliated with, sponsored by, endorsed by, authorized by, or officially
            connected to Instructure, Inc., Canvas™, Canvas LMS™, or any of their parent
            corporations, subsidiaries, or affiliates.
          </p>
          <p>
            <strong className="text-foreground">Trademarks.</strong> "Canvas" and "Canvas
            LMS", along with associated logos and wordmarks, are trademarks owned by
            Instructure, Inc. References to them here are nominative and descriptive only,
            to denote technical compatibility with the Canvas REST API.
          </p>
          <p>
            <strong className="text-foreground">No institutional endorsement.</strong> Your
            school, college, university, or district does not endorse, review, sponsor,
            administer, or assume responsibility for Canvas Pro.
          </p>
        </Section>

        <Section title="2. Fair use, anti-abuse, and sync limits">
          <p>
            Every synchronization retrieves data from external Canvas servers and consumes
            cloud compute, bandwidth, and memory, which carries real cost to the operator.
            Canvas Pro is offered strictly for personal, interactive student productivity,
            and you agree to the following:
          </p>
          <p>
            1. No sync hammering or refresh spam, and no attempts to circumvent sync
            cooldown timers.
          </p>
          <p>
            2. No scrapers, automated scripts, bots, cron jobs, headless browsers, or
            command-line loops polling Canvas Pro endpoints.
          </p>
          <p>
            3. No intentional or reckless attempts to inflate the operator's hosting,
            compute, bandwidth, or database costs through repetitive queries.
          </p>
          <p>4. Server-side caching intervals and request rate limits are enforced.</p>
          <p>
            5. The operator may throttle, suspend, block, or terminate without notice or
            refund any account showing excessive, anomalous, or automated behavior, and may
            seek restitution for infrastructure costs caused by willful abuse.
          </p>
        </Section>

        <Section title="3. Information we collect">
          <p>
            <strong className="text-foreground">Account and student profile.</strong> First
            name, last name, nickname, email address, school, major or field of study, and
            graduation year. Authentication uses salted, hashed passwords or third-party
            identity tokens (Google or Apple).
          </p>
          <p>
            <strong className="text-foreground">Canvas API access token.</strong> Your
            personal Canvas API key is stored encrypted and used only to make authenticated
            read requests to your institution's Canvas LMS on your behalf. It is never
            shared with, sold to, or viewable by other users, advertisers, or data brokers.
          </p>
          <p>
            <strong className="text-foreground">Cached Canvas content.</strong> Courses,
            course codes, syllabus links, enrollments, assignments and deadlines, grades and
            category weightings, instructor feedback, announcements, and calendar items.
          </p>
          <p>
            <strong className="text-foreground">Notification tokens.</strong> Web push and
            mobile push device tokens needed to deliver deadline warnings, grade change
            alerts, and announcement notifications.
          </p>
          <p>
            <strong className="text-foreground">Technical telemetry.</strong> IP addresses,
            browser user agents, request timestamps, sync counters, and error logs, used only
            to detect fraud and abuse and to maintain uptime.
          </p>
        </Section>

        <Section title="4. How we use your data">
          <p>
            We use your data to render your dashboards, focus lists, and GPA summaries, to
            send the alerts you configure, to address you by your chosen name, and to enforce
            rate limits and platform security.
          </p>
          <p>
            We do not sell, rent, broker, or trade your personal or academic information to
            advertisers or data brokers under any circumstances.
          </p>
        </Section>

        <Section title="5. FERPA and educational privacy">
          <p>
            Under FERPA (20 U.S.C. § 1232g) and comparable frameworks, Canvas Pro acts solely
            as a private software interface operated at the voluntary direction of the
            individual student.
          </p>
          <p>
            Canvas Pro is not an official vendor, institutional contractor, or designated
            "school official" of your institution.
          </p>
          <p>
            You represent that you are an enrolled student authorized to view the Canvas
            records retrieved, that the API token belongs to you, and that its use conforms to
            your institution's technology policies.
          </p>
        </Section>

        <Section title="6. Third-party infrastructure">
          <p>
            <strong className="text-foreground">Database and authentication.</strong> Managed
            PostgreSQL with encrypted token storage and JWT authentication.
          </p>
          <p>
            <strong className="text-foreground">Notifications.</strong> Apple Push Notification
            service, Google Firebase Cloud Messaging, and standard Web Push protocols.
          </p>
        </Section>

        <Section title="7. Retention, deletion, and revocation">
          <p>
            <strong className="text-foreground">Instant disconnect.</strong> You can revoke
            access at any time with "Clear key" in Settings, or by deleting the approved
            integration token in your Canvas account (Account → Approved Integrations). All
            live API communication stops immediately.
          </p>
          <p>
            <strong className="text-foreground">Account deletion.</strong> You may delete your
            account and request erasure of your profile, cached academic data, and notification
            tokens through Settings or by emailing{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <p>
            <strong className="text-foreground">Profile editing.</strong> You may update your
            name, nickname, school, major, and class year at any time in Settings.
          </p>
        </Section>

        <Section title="8. Disclaimers and limitation of liability">
          <p>
            <strong className="text-foreground">Not the official source of truth.</strong> Your
            school's Canvas portal and your professors remain the authoritative record of your
            courses, due dates, grades, and academic standing.
          </p>
          <p>
            <strong className="text-foreground">Provided "as is".</strong> Canvas Pro is provided
            without warranties of any kind. We do not guarantee error-free operation,
            uninterrupted uptime, or instant notification delivery; Canvas outages or university
            firewall changes may interrupt service.
          </p>
          <p>
            <strong className="text-foreground">Liability.</strong> To the maximum extent
            permitted by law, the operator is not liable for missed deadlines, late penalties,
            grade reductions, disciplinary actions, exam absences, financial losses, or lost
            academic credit arising from use of, or inability to use, this application.
          </p>
        </Section>

        <Section title="9. Contact us">
          <p>
            For questions, feedback, or privacy and legal inquiries, email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

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
