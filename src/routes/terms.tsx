import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — CanvasPro" },
      {
        name: "description",
        content:
          "Eligibility, responsibilities, service limitations, and legal terms for CanvasPro.",
      },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/terms" }],
  }),
  component: () => <LegalPage title="Terms of Use" sections={sections} />,
});

const sections = [
  {
    title: "1. Who we are and what you accept",
    paragraphs: [
      "These Terms of Use are an agreement between you and the independent operator of CanvasPro (“CanvasPro,” “we,” “us”), reachable at support@canvaspro.app. They govern canvaspro.app, the installed web app, the mobile app, and related account services. By selecting the agreement checkbox when creating an account or signing in, you accept these Terms and acknowledge the data practices described in the Privacy Policy. If you do not agree, do not create an account or sign in.",
      "CanvasPro is not affiliated with, sponsored by, endorsed by, or officially connected to Instructure, Inc., Canvas LMS, or your educational institution. Canvas and Canvas LMS are their owners’ trademarks. References identify compatibility only.",
    ],
  },
  {
    title: "2. Eligibility: age 13 and older",
    paragraphs: [
      "You must be at least 13 years old to create an account or use CanvasPro. Children under 13 may not use the service, including with a parent’s account or permission. Do not submit personal information about a child under 13.",
      "If you are 13 or older but below the age of legal adulthood where you live, you may use CanvasPro only with a parent or legal guardian’s permission and supervision. Ask them to review these Terms and the Privacy Policy with you. You must also meet any higher age or consent requirement that applies in your location. The age checkbox is your confirmation; it is not independent identity or age verification.",
      "You must have authority to access the school account and records you connect. A school account does not by itself establish permission to use third-party software.",
    ],
  },
  {
    title: "3. The service and academic responsibility",
    paragraphs: [
      "CanvasPro organizes Canvas courses, assignments, deadlines, grades, announcements, calendars, and user-entered schedules. It also offers Focus, Today’s Plan, workload estimates, study sessions, widgets, and reminders. Features and compatibility can change.",
      "Your institution’s Canvas portal, syllabus, instructors, and official records remain authoritative. Check them directly for deadlines, time zones, submission requirements, extensions, grade changes, and emergencies. Cached data can be incomplete or out of date, and app calculations or displays can contain errors.",
      "Marking an item complete, starting a study session, or opening an assignment in CanvasPro does not submit coursework to Canvas, change an instructor’s deadline, or earn academic credit. Recommended tasks, duration estimates, priorities, and study plans are organizational estimates, not academic advice or promises of grades, admission, graduation, or results.",
    ],
  },
  {
    title: "4. Accounts and Canvas access",
    paragraphs: [
      "Provide accurate account information, protect your credentials and devices, and promptly report suspected unauthorized access. Do not share, sell, or transfer accounts or use someone else’s Canvas token. You are responsible for your authorized use and for reasonable care of your credentials; this clause does not shift responsibility for our legal obligations to you.",
      "By connecting Canvas, you authorize us to store and use the token and institution address you provide to retrieve permitted data and operate features you enable, including background reminders. Use only tokens you are authorized to provide and comply with your institution’s rules and Canvas’s applicable terms.",
      "You can remove the saved key in Settings and revoke the token in Canvas. Revocation prevents future successful token use, but does not recall information already retrieved or notifications already sent. A token may provide broader access than the features CanvasPro uses, so keep it confidential.",
    ],
  },
  {
    title: "5. Acceptable use and service protection",
    paragraphs: [
      "Use CanvasPro for lawful, personal productivity. Do not access other users’ records, probe or bypass authentication or rate limits, exploit vulnerabilities, distribute malware, impersonate others, infringe intellectual property or privacy rights, or harass people through the service.",
      "Do not scrape, resell, bulk-export other users’ information, automate excessive requests, evade sync cooldowns, or intentionally increase infrastructure costs. These restrictions do not prohibit assistive technologies or conduct that applicable law expressly permits.",
      "We may limit requests or restrict access when reasonably necessary to protect users, comply with law, investigate abuse, or maintain service availability. You may report vulnerabilities privately to support@canvaspro.app; do not access or retain other users’ data to demonstrate a problem.",
    ],
  },
  {
    title: "6. Your content and our intellectual property",
    paragraphs: [
      "You retain rights you hold in your profile, schedules, notes, and other content you provide. You give CanvasPro a limited, nonexclusive permission to host, copy, process, and display that content only to operate, secure, support, and improve the service as described in the Privacy Policy. This does not transfer ownership of academic records or authorize public publication of private content.",
      "You must have the rights needed for information you upload or connect. CanvasPro’s original software, design, branding, and content belong to their respective owners. We grant you a limited, personal, nonexclusive, nontransferable right to use the service while you comply with these Terms. Third-party and open-source components remain subject to their licenses.",
    ],
  },
  {
    title: "7. Notifications, integrations, and availability",
    paragraphs: [
      "Notifications depend on your settings, device permissions, operating system, network, browser, installation method, and external services. They can be delayed, duplicated, missing, or displayed on a lock screen. Background delivery and timers are not guaranteed when an app or device is closed, offline, suspended, or in a battery-saving mode. Maintain your own deadline reminders.",
      "Canvas, hosting, email, payment, and device services are outside our direct control and have their own terms. Their outages, API changes, token revocation, school restrictions, and maintenance can interrupt CanvasPro. We do not promise continuous availability, a particular response time, indefinite support, or preservation of every feature.",
    ],
  },
  {
    title: "8. Fees and existing billing arrangements",
    paragraphs: [
      "CanvasPro currently offers its features free of charge and does not offer new subscriptions. An existing subscription may continue to renew under the billing terms originally accepted until canceled. If a billing portal is available in your account, use it to cancel; otherwise contact support@canvaspro.app. Access to current free features does not depend on keeping an existing subscription.",
      "Canceling a subscription, deleting an app, revoking a Canvas key, and deleting an account are different actions. Cancel any existing subscription before deleting your account, or contact support@canvaspro.app for assistance. Refunds and cancellation rights required by law remain available. Any future paid offering will disclose its price and billing terms and require authorization before charging you.",
    ],
  },
  {
    title: "9. Warranty disclaimer",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT EXPRESS OR IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT CONTENT IS COMPLETE OR ACCURATE OR THAT THE SERVICE IS UNINTERRUPTED, ERROR-FREE, OR IMMUNE FROM SECURITY INCIDENTS.",
      "Some jurisdictions do not allow all warranty exclusions. These exclusions apply only where permitted and do not remove mandatory consumer guarantees or any obligation we cannot lawfully disclaim.",
    ],
  },
  {
    title: "10. Limits of liability",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, CANVASPRO AND ITS OPERATOR ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR LOST PROFITS, LOST OPPORTUNITIES, OR LOSS OF DATA ARISING FROM USE OF OR INABILITY TO USE THE SERVICE. THIS INCLUDES SUCH LOSSES ASSOCIATED WITH MISSED REMINDERS, DEADLINES, SUBMISSIONS, OR INACCURATE ACADEMIC ESTIMATES.",
      "To the maximum extent permitted by law, our total aggregate liability for claims arising from the service or these Terms will not exceed the greater of US $100 or the amount you paid to CanvasPro during the 12 months before the event giving rise to the claim.",
      "These limitations apply regardless of the legal theory and only to the extent enforceable. They do not exclude or limit liability for fraud, intentional misconduct, gross negligence, death or personal injury caused by negligence where protected by law, or any other liability or statutory remedy that cannot legally be excluded or limited. They do not excuse us from applicable privacy or data-security obligations.",
    ],
  },
  {
    title: "11. Responsibility for unlawful conduct",
    paragraphs: [
      "To the extent permitted by law, you agree to reimburse the operator for reasonable, documented losses and legal costs resulting from a third-party claim caused by your intentional unlawful use, knowing infringement of another person’s rights, or material breach of these Terms. This does not cover claims caused by our own unlawful conduct, negligence, or breach of our obligations.",
      "We will give reasonable notice of such a claim and an opportunity to participate in its defense. We will not agree to a settlement imposing an admission or nonmonetary obligation on you without your consent. This provision applies to minors only to the extent a binding obligation is permitted by applicable law.",
    ],
  },
  {
    title: "12. Suspension, closure, and deletion",
    paragraphs: [
      "We may suspend or terminate access for material violations, security risks, legal requirements, or discontinuation of the service. Where reasonably practicable, we will provide notice and an opportunity to address the issue; urgent security or legal circumstances may require immediate action. Contact support to ask us to review a restriction.",
      "You may stop using CanvasPro, revoke Canvas access, or delete your account in Settings. Deletion and retention are addressed in the Privacy Policy. Keep independent copies of information you need. Provisions concerning accrued payment obligations, intellectual property, liability, disputes, and obligations intended to survive remain effective after account closure, subject to applicable law.",
    ],
  },
  {
    title: "13. Disputes and applicable law",
    paragraphs: [
      "Michigan law governs these Terms, excluding its conflict-of-laws rules, except that mandatory protections of your place of residence continue to apply. Courts in Michigan have jurisdiction to the extent permitted by law; this does not prevent a consumer from bringing a claim in a court that applicable law entitles them to use.",
      "Please contact support@canvaspro.app with a description of a dispute so we can try to resolve it. Contacting us is encouraged, not a condition that removes access to courts, regulators, small-claims procedures, or time-sensitive relief. These Terms do not impose mandatory arbitration or a class-action waiver.",
    ],
  },
  {
    title: "14. Changes and general provisions",
    paragraphs: [
      "We will identify revisions by the updated date. Material changes will be communicated through the service or account contact information, and renewed agreement will be requested where required. Changes do not retroactively waive existing claims or authorize materially different uses of previously collected data without any consent required by law.",
      "If a provision is unenforceable, it will be limited or severed to the extent necessary and the remaining provisions continue where lawful. Failure to enforce a provision is not a waiver. These Terms and expressly agreed feature-specific terms form the agreement about service use; the Privacy Policy explains data handling and does not waive privacy rights.",
      "Questions, account concerns, legal notices, and complaints may be sent to support@canvaspro.app.",
    ],
  },
];
