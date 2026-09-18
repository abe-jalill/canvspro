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
          LAST UPDATED: SEPTEMBER 17, 2026
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {"\n\n# PRIVACY POLICY & DATA USE POLICY\u00a0"}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          CanvasPro is built to give you a clear, personal view of your own
          Canvas LMS data. This policy explains what we collect, how we use it,
          and how you can manage your information.
        </p>

        <section className="mt-10">
          <h2 className="whitespace-pre-line text-lg font-semibold tracking-tight">
            {`# PRIVACY POLICY & DATA USE POLICY — CANVAS PRO
Canvas Pro ("we," "our," "us," or the "Service") is committed to personal privacy and transparent data practices. This Privacy Policy governs the collection, use, retention, protection, and operational limitations of user information when you access or use the Canvas Pro web application, connect an API key, or register a student account.
BY ACCESSING OR USING CANVAS PRO, CREATING AN ACCOUNT, OR PROVIDING A CANVAS API KEY, YOU EXPLICITLY ACKNOWLEDGE AND AGREE TO ALL PRACTICES, RESTRICTIONS, RATE LIMITS, AND LEGAL DISCLAIMERS CONTAINED IN THIS PRIVACY POLICY.
---
### 1. STRICT NON-AFFILIATION DISCLAIMER (CANVAS LMS / INSTRUCTURE, INC.)
Canvas Pro is an independent, third-party companion application created and operated solely by an independent software developer. 
- NON-AFFILIATION: Canvas Pro is NOT affiliated with, sponsored by, endorsed by, authorized by, maintained by, or in any way officially connected to Instructure, Inc., Canvas™, Canvas LMS™, or any of their parent corporations, subsidiaries, or affiliates.
- TRADEMARK NOTICE: The names "Canvas," "Canvas LMS," as well as associated logos, wordmarks, and trade dress are registered trademarks owned exclusively by Instructure, Inc. Any references to "Canvas" or "Canvas LMS" within Canvas Pro, its documentation, interface, or promotional materials are made strictly for nominative, descriptive identification under fair use doctrine to denote third-party technical compatibility with the Canvas REST API.
- NO INSTITUTIONAL ENDORSEMENT: Your school, college, university, or educational district does not endorse, review, sponsor, administer, or assume any responsibility for Canvas Pro.
---
### 2. STRICT FAIR USE, ANTI-ABUSE, AND SYNC QUOTA POLICY (RESOURCE COST PROTECTION)
Because Canvas Pro communicates with external Canvas LMS servers to retrieve, parse, and format course schedules, assignments, and grades, every synchronization event consumes serverless cloud computing power, outbound network bandwidth, and memory resources. These server executions incur tangible financial and operational costs to the developer/operator.
Canvas Pro is offered strictly for personal, interactive student productivity. You expressly agree to abide by the following Fair Use and Anti-Abuse terms:
1. Prohibition of Sync Hammering and Automated Spams: You shall not repeatedly trigger manual data syncs, spam page refreshes, or attempt to circumvent automated sync cooldown timers.
2. Prohibition of Bots and Scrapers: You shall not use web scrapers, automated scripts, bots, cron jobs, headless browsers, or command-line loops (e.g., curl, wget) to poll or query Canvas Pro endpoints.
3. Prohibition of "Denial-of-Wallet" Resource Abuse: Any intentional or reckless attempt to artificially inflate the operator’s cloud hosting, compute, bandwidth, or database expenses through repetitive queries or API hammering is strictly unlawful and grounds for immediate legal and civil recourse.
4. Mandatory Rate Limits and Caching: Canvas Pro enforces automated server-side caching intervals and request rate limits. 
5. Unilateral Throttling and Immediate Termination: The operator reserves the absolute, unilateral right to immediately throttle, suspend, block IP addresses of, or permanently terminate without prior notice or refund any account or user exhibiting excessive, anomalous, abusive, or automated synchronization behavior. The operator further reserves all legal rights to seek financial restitution for infrastructure expenses resulting from willful resource abuse.
---
### 3. INFORMATION WE COLLECT
We collect only the minimum information necessary to render your dashboard and deliver requested reminders:
A. Account & Student Profile Information:
- Identity Data: First Name ("Name"), Last Name, Nickname, and email address.
- Academic Profile: Educational Institution ("School"), Major/Field of Study, and Graduation Year ("Class of ____").
- Authentication Data: Salted and cryptographically hashed passwords or third-party federated identity tokens (e.g., Google or Apple OAuth identifiers).
B. Canvas API Access Tokens:
- To display your academic data, you may provide your personal Canvas API key/token.
- Your token is stored encrypted in our managed database.
- Your token is utilized strictly to make authenticated read requests to your institution’s Canvas LMS API on your behalf.
- Your token is never shared with, sold to, or viewable by other users, advertisers, or third-party brokers.
C. Canvas LMS Academic Content (Cached):
- Courses, course codes, syllabus links, and enrollment details.
- Assignments, descriptions, point values, deadlines, and submission statuses.
- Real-time and cumulative course grades, category weightings, and instructor feedback.
- Announcements and academic calendar/schedule items.
D. Notification & Device Tokens:
- Unique web push / mobile push device tokens (e.g., Web Push, Apple APNs, Firebase Cloud Messaging) needed to deliver scheduled deadline warnings, grade change alerts, and announcement notifications.
E. Technical Diagnostic & Rate-Limit Telemetry:
- IP addresses, browser user-agents, request timestamps, sync counters, error logs, and payload counts. This data is monitored exclusively to detect fraud, prevent denial-of-service/denial-of-wallet abuse, and maintain application uptime.
---
### 4. HOW WE USE YOUR DATA
We use your data solely to operate the core functionality of Canvas Pro:
- Rendering personalized academic dashboards, focus checklists, and GPA summaries.
- Dispatching user-configured alerts for approaching deadlines and updated grades.
- Addressing you by your chosen name or nickname.
- Enforcing rate limits, preventing infrastructure abuse, and ensuring platform security.
WE DO NOT SELL, RENT, BROKER, OR TRADE YOUR PERSONAL OR ACADEMIC INFORMATION TO ADVERTISERS OR DATA BROKERS UNDER ANY CIRCUMSTANCES.
---
### 5. FERPA & EDUCATIONAL REGULATORY DISCLAIMER
- Individual User-Directed Client: Under the Family Educational Rights and Privacy Act (FERPA) (20 U.S.C. § 1232g) and comparable education privacy frameworks, Canvas Pro functions solely as a private, client-side software interface operated at the voluntary direction and request of the individual student.
- Not a School Official: Canvas Pro is not an official vendor, institutional contractor, or designated "school official" of your educational institution.
- Student Authority & Responsibility: You represent and warrant that you are a legitimately enrolled student authorized to view the Canvas records retrieved, that the API token provided belongs to you, and that your generation and use of the token conforms to your institution's acceptable technology policies.
---
### 6. THIRD-PARTY INFRASTRUCTURE SUBPROCESSORS
Canvas Pro relies on reputable cloud infrastructure partners to maintain high availability and security:
- Database & Authentication: Supabase / Lovable Cloud (managed PostgreSQL with encrypted token storage and JWT authentication).
- Payment Processing: Stripe, Inc. If you subscribe to a paid tier, your card data is processed directly by Stripe. Canvas Pro never captures or stores your full credit card number or bank secrets.
- Notification Delivery: Apple Push Notification service (APNs), Google Firebase Cloud Messaging (FCM), and standard Web Push protocols.
---
### 7. DATA RETENTION, DELETION & REVOCATION RIGHTS
- Instant API Disconnect: You may revoke Canvas Pro’s access to your Canvas data at any time by clicking "Clear key" in the Settings page, or by deleting the approved integration token directly within your official school Canvas LMS account (under Account → Approved Integrations). Once cleared or revoked, all live API communication ceases immediately.
- Complete Account & Data Deletion: You may delete your account and request complete erasure of your profile, cached academic data, and notification tokens through Settings or by emailing [YOUR_EMAIL].
- Profile Editing: You may update or correct your Name, Nickname, School, Major, and Class of ____ at any time from your Settings screen.
---
### 8. DISCLAIMER OF WARRANTIES & LIMITATION OF LIABILITY
- NOT THE OFFICIAL SOURCE OF TRUTH: Canvas Pro is a convenience companion tool. Your school’s official Canvas LMS web portal and your professors remain the sole authoritative, legally binding record of your courses, due dates, grades, and academic standing.
- "AS IS" PROVISION: Canvas Pro is provided strictly on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind. We do not guarantee error-free operation, uninterrupted server uptime, or instantaneous notification delivery. Upstream Canvas LMS outages or university firewall modifications may interrupt service.
- TOTAL LIABILITY WAIVER: To the maximum extent permitted by applicable law, the operator and creator of Canvas Pro shall not be liable for any missed deadlines, late penalties, grade reductions, academic disciplinary actions, exam absences, financial losses, or loss of academic credit arising from the use of, or inability to use, this application.
---
### 9. CONTACT US
For questions, feedback, or legal and privacy inquiries, please contact:
Email: `}
          </h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>{"\n"}</p>
            <p>{"\n"}</p>
            <p>{"\n"}</p>
            <p>{"\n"}</p>
            <p>{"\n"}</p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">{"\n"}</h2>
          <p className="mt-4 text-sm text-muted-foreground">{"\n"}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">{"\n"}</h2>
          <p className="mt-4 text-sm text-muted-foreground">{"\n"}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">{"\n"}</h2>
          <p className="mt-4 text-sm text-muted-foreground">{"\n"}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">{"\n"}</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            {"\n"}
            <a
              href="mailto:[YOUR_EMAIL]"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {""}
            </a>
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">{"\n"}</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            {"\n"}
            <a
              href="mailto:[YOUR_EMAIL]"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {""}
            </a>
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
