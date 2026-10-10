import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalHighlight, type LegalSection } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — CanvasPro" },
      {
        name: "description",
        content:
          "How CanvasPro handles account, Canvas, usage, notification, and billing information, and the choices and rights you have.",
      },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/privacy" }],
  }),
  component: () => (
    <LegalPage title="Privacy Policy" intro={intro} highlights={highlights} sections={sections} />
  ),
});

const intro =
  "CanvasPro helps students see their Canvas courses, deadlines, and grades in one place. To do that, it handles personal and academic information. This policy explains what we collect, why, who it is shared with, how long it is kept, and the choices you have.";

const highlights: LegalHighlight[] = [
  {
    title: "We do not sell your data",
    body: "We do not sell personal or academic information, and we do not share it for advertising. The app has no advertising trackers.",
  },
  {
    title: "Read-only access to Canvas",
    body: "CanvasPro reads your Canvas information to show it to you. It does not submit work or change anything in Canvas.",
  },
  {
    title: "Your Canvas token is write-only",
    body: "After you save a Canvas access token, browsers and the app cannot read it back. Only our server uses it, to fetch your data and send alerts.",
  },
  {
    title: "You can leave at any time",
    body: "Delete your account in Settings to remove your account and app data. You can also revoke your token in Canvas whenever you like.",
  },
];

const sections: LegalSection[] = [
  {
    title: "1. Who we are and what this covers",
    paragraphs: [
      "CanvasPro is operated by an independent operator and is available at canvaspro.app as a website, an installable web app, and a mobile app (together, the “Service”). We are the party that decides how your information is used, which privacy laws call the “controller.” Contact us at support@canvaspro.app for any privacy question or request.",
      "CanvasPro is independent of Instructure, Inc., Canvas LMS, and your school. Canvas and your school have their own privacy policies, which govern the information they hold. This policy covers only information handled through CanvasPro.",
      "This policy describes our data practices. Accepting it does not waive your privacy rights or give blanket consent to unrelated optional processing.",
    ],
  },
  {
    title: "2. Information we collect",
    paragraphs: [
      "The table below summarizes the categories of information we handle. Sections 3 to 6 explain each in more detail.",
    ],
    table: {
      caption: "Categories of information CanvasPro handles",
      headers: ["Category", "Examples", "Why we use it"],
      rows: [
        [
          "Account and profile",
          "Email address, account identifier, name, and optional username, nickname, profile image, school, major, and graduation year",
          "Sign-in, account security, personalization, and support",
        ],
        [
          "Canvas connection",
          "Your Canvas web address and the personal access token you save",
          "Making authenticated, read-only requests to Canvas on your behalf",
        ],
        [
          "Academic information from Canvas",
          "Courses, enrollments, assignments, due dates, submission status, scores, grade details, announcements, and calendar events",
          "Showing and organizing your coursework, estimates, and reminders",
        ],
        [
          "Information you create",
          "Course nicknames, schedules, completion flags, priorities, time estimates, plan and study-session choices, widgets, and appearance settings",
          "Saving your preferences and plans",
        ],
        [
          "Notification data",
          "Push subscription details, reminder preferences, scheduled alerts, and delivery records",
          "Sending the reminders and alerts you turn on",
        ],
        [
          "Usage and technical data",
          "Activity dates and counts, last-seen time, IP address, device and browser details, request times, and error diagnostics",
          "Operating, securing, troubleshooting, and improving the Service",
        ],
        [
          "Agreement and age confirmation",
          "Your confirmation that you are 13 or older, and the policy versions and time you agreed",
          "Keeping a record of what you accepted",
        ],
        [
          "Billing",
          "Customer and subscription identifiers and billing status (payment details go to Stripe)",
          "Managing paid plans where they apply",
        ],
      ],
    },
  },
  {
    title: "3. Your account and profile",
    paragraphs: [
      "We process your email address, account identifier, authentication information, first and last name, and any username, nickname, profile image, school, major, or graduation year you choose to provide. Some profile fields are optional. Supabase provides account authentication and session management.",
      "We store your self-confirmation that you are at least 13, its time and version, and the policy versions and timestamp associated with your agreement. We do not request a birth date or identity document for the age checkbox, and these confirmations are not independent age verification.",
      "When you contact support, we receive your message, contact details, any attachments you choose to send, and the information needed to resolve the issue. Please do not send passwords or Canvas access tokens by email.",
    ],
  },
  {
    title: "4. Your Canvas connection and academic information",
    paragraphs: [
      "When you connect Canvas, we receive your school’s Canvas address and the personal access token you create in Canvas. We use the token only to make read-only requests to Canvas for you, including the background checks that power closed-app notifications.",
      "The token is stored on our backend so our servers can use it. Database permissions prevent signed-in browsers and the app from reading the token back; the interface can only tell whether a token is saved. The token is not end-to-end encrypted from CanvasPro’s backend, so authorized server components, and authorized personnel where needed for support or security, are technically able to access it. Treat a Canvas token like a password.",
      "Depending on what your school exposes and the features you use, we retrieve courses, course codes, enrollments, assignments, due dates, submission status, scores, grade details and weights, syllabus information, announcements, and calendar information. Some of this data is cached temporarily on our servers and on your device so that pages load faster and recent views work.",
      "We use academic information only to provide the Service’s productivity features. We do not use it for advertising, we do not sell it, and we do not use it to make official educational decisions about you.",
      "We process this information at your direction as a student using your own account. CanvasPro is not your school’s designated “school official” under FERPA and is not an institutional records system. Your school’s Canvas records remain the official record.",
    ],
  },
  {
    title: "5. Notifications",
    paragraphs: [
      "If you turn on notifications, we process your push subscription endpoint, delivery keys or device tokens where applicable, browser or device details, reminder preferences, scheduled-alert information, and delivery records. The push service for your browser or device routes messages to you.",
      "To send alerts when the app is closed, our servers check Canvas on your behalf on a regular schedule, for example for upcoming due dates, new grades, and announcements, and for the class and evening reminders you enable.",
      "Notification text can include assignment titles, course names, deadlines, or grade and announcement information, and it may appear on your lock screen. You can change permissions in the app and in your device settings at any time.",
    ],
  },
  {
    title: "6. Usage, technical data, and device storage",
    paragraphs: [
      "We record account-linked activity dates, last-seen times, and periodic activity counts to understand daily, weekly, and monthly use. Authorized administrators can see aggregate totals and a recent-activity list that includes an account email or identifier, last-seen time, and counts. These are approximate activity measures, not a record of every click or an exact measure of study time.",
      "Our infrastructure and service providers may process IP addresses, browser or device information, request times, security and authentication logs, and error details. Error reports can include the current route and diagnostic context. We use this information to operate, troubleshoot, secure, and improve the Service and to detect abuse.",
      "We use browser and app storage for login sessions, cached Canvas results tied to your account, settings, plan and study state, and related features. Service workers cache app resources so the installed web app works reliably. This is first-party functional storage. The Service does not use advertising trackers and does not sell personal information.",
      "Clearing browser storage may sign you out and remove locally stored preferences or unsynced data. Signing out clears account-scoped storage on that device. It does not remove data on other devices, downloaded files, operating-system backups, or information already sent elsewhere.",
    ],
  },
  {
    title: "7. AI assistant connections",
    paragraphs: [
      "CanvasPro can offer a read-only connection for AI assistants that support the Model Context Protocol. If you choose to connect one, you sign in to CanvasPro and approve access on a consent screen. The assistant can then request your courses and grades, assignments and due dates, announcements, and calendar events.",
      "When you use that connection, the information the assistant requests is sent to the assistant you chose, and its provider’s terms and privacy policy govern what happens next. CanvasPro does not choose or control those providers. Connect only assistants you trust, and revoke access from the assistant or by contacting support@canvaspro.app if you no longer want it.",
    ],
  },
  {
    title: "8. How we use information",
    paragraphs: [
      "We use information to authenticate you, connect to Canvas, display and organize academic information, calculate estimates, save preferences, deliver the reminders and account emails you ask for, provide support, measure service use, diagnose problems, prevent abuse, and meet legal obligations.",
      "We do not sell your personal or academic information, and we do not share it for cross-context behavioral advertising.",
    ],
  },
  {
    title: "9. Who receives information",
    paragraphs: [
      "We share information only with the providers and parties below, and only as needed to run the Service. Their handling of information is also governed by their own terms and privacy notices.",
    ],
    table: {
      caption: "Service providers and other recipients",
      headers: ["Recipient", "Role", "Information involved"],
      rows: [
        [
          "Supabase",
          "Authentication, database, and file storage",
          "Account, profile, Canvas connection, preferences, notification and usage data",
        ],
        [
          "Cloudflare and Lovable",
          "Hosting and development infrastructure",
          "Requests to the Service and technical data",
        ],
        [
          "Email delivery services",
          "Sending account messages",
          "Email address and message content",
        ],
        [
          "Push services for your browser or device",
          "Delivering notifications you enable",
          "Push subscription details and notification content",
        ],
        [
          "Your school’s Canvas service",
          "Source of your academic information",
          "Authenticated requests made with your token",
        ],
        [
          "Stripe",
          "Payment processing where you have a billing relationship",
          "Payment details (entered with Stripe, not on CanvasPro forms) and billing identifiers",
        ],
        [
          "AI assistant you connect (optional)",
          "Receives information you authorize it to request",
          "Courses, grades, assignments, announcements, and calendar events",
        ],
      ],
    },
  },
  {
    title: "10. Other disclosures",
    paragraphs: [
      "Authorized personnel may access information when needed for administration, support, troubleshooting, or security. We may disclose information to comply with valid legal process, to protect rights, safety, and security, to investigate fraud or abuse, or as part of a business transfer, subject to applicable privacy requirements. We may also disclose information when you direct us to. Other students cannot see your private academic data through the app.",
      "The public website links to optional Google Forms for problem reports and surveys. If you open or submit one, Google and the form owner receive what you submit, along with the technical information described in Google’s privacy terms. Please do not include a password, Canvas token, or academic record in those forms.",
      "Third parties may collect information when you deliberately leave CanvasPro for an external service, such as Canvas, Stripe, or a Google Form. We do not authorize those services to track you across unrelated websites for advertising on our behalf.",
    ],
  },
  {
    title: "11. Retention and deletion",
    paragraphs: [
      "We keep account information and saved preferences while they are needed to provide your account, and longer only where reasonably necessary for security, disputes, billing, or legal obligations. Canvas caches are temporary and are refreshed or expire. Because retention differs by category and provider, we do not promise a single deletion period for every system.",
      "You can delete your account in Settings, or ask for help at support@canvaspro.app. Deletion removes your authentication account and the app records associated with it, including your profile pictures. If you have a paid subscription that may still renew, cancel it first through billing or contact support so you are not charged after deletion. Limited records may remain in backups, provider logs, or legal holds until their retention period ends. Deletion does not remove your school’s Canvas records.",
      "Removing a saved Canvas token stops future use of it once the change takes effect. Requests already in progress, cached results, or queued notifications may persist briefly. Revoke the token in Canvas to invalidate it at its source. Removing a token is not the same as deleting your account.",
    ],
  },
  {
    title: "12. Security",
    paragraphs: [
      "We use authenticated access, account-scoped storage, database access controls, and transport security to help protect information. Background notification jobs run on our servers, and Canvas tokens are write-only for browsers and the app.",
      "No service or transmission method is completely secure, and we cannot guarantee that unauthorized access, data loss, or security incidents will never occur. Protect your device and login credentials, avoid staying signed in on shared devices, revoke any Canvas token you think was exposed, and report suspected incidents to support@canvaspro.app. Where the law requires it, we will notify affected users and authorities of a data incident.",
    ],
  },
  {
    title: "13. Your choices and rights",
    paragraphs: [
      "In the app you can edit profile fields and preferences, remove a Canvas token, manage notification permissions, clear device storage, and delete your account. For anything you cannot do yourself, contact support@canvaspro.app. We will never ask for your password or Canvas token to process a request.",
      "Depending on where you live, you may have the right to access, correct, delete, or receive a copy of your personal information; to restrict or object to certain processing; to withdraw consent for consent-based processing; and to appeal a decision on your request. Residents of California and certain other US states, and people in the European Economic Area, the United Kingdom, and similar regions, have rights of this kind under their local laws.",
      "To make a request, email support@canvaspro.app. We may need to verify your identity in a proportionate way, and we will explain any legal limit on a request. You may use an authorized agent where the law allows, and you may complain to your local privacy regulator. Using your rights will not lead us to treat you unfairly. Withdrawing optional consent does not affect earlier lawful processing, and agreeing to our Terms does not remove your statutory privacy rights.",
      "Browser signals: CanvasPro does not sell personal information or share it for cross-context behavioral advertising, and it does not use third-party advertising trackers. Because there is nothing to opt out of, Global Privacy Control and Do Not Track signals do not change how the Service works. If these practices change, we will update this policy and honor legally required opt-out signals.",
    ],
  },
  {
    title: "14. International processing and legal bases",
    paragraphs: [
      "CanvasPro and its providers may process information in the United States and in other countries where their systems operate. Privacy laws there may differ from those where you live. Where the law requires transfer safeguards or a legal basis for processing, those requirements continue to apply.",
      "Where such laws apply, we rely on the following legal bases: performing our agreement with you for providing your account and the features you request; legitimate interests for security, troubleshooting, and proportionate usage measurement; legal obligations for compliance; and your consent for optional features. Contact support@canvaspro.app with questions about your location or about the safeguards for a transfer.",
    ],
  },
  {
    title: "15. Children and teenagers",
    paragraphs: [
      "CanvasPro is meant for people aged 13 and older, mainly college students. Children under 13 may not create an account or use the Service. If you are below the age of legal adulthood where you live, you need a parent or guardian’s permission and must meet any higher local age or consent requirement.",
      "We do not knowingly collect personal information from children under 13. If you believe a child under 13 has given us personal information, contact support@canvaspro.app. We will investigate, stop collecting the information, and delete it as the law requires. A parent’s report is taken seriously even if the account checked the age box.",
    ],
  },
  {
    title: "16. Changes and contact",
    paragraphs: [
      "The effective date at the top of this page shows when the policy last changed. We will tell you about material changes through the app or your account email, and we will ask for your consent again where the law requires it before using information previously collected in a materially different way. This policy does not override applicable law.",
      "Questions, requests, or concerns about privacy can be sent to support@canvaspro.app. Our Terms of Use separately cover eligibility, acceptable use, and the rules for using the Service.",
    ],
  },
];
