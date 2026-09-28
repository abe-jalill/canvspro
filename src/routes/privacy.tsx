import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — CanvasPro" },
      {
        name: "description",
        content:
          "How CanvasPro handles account, Canvas, usage, notification, and billing information.",
      },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/privacy" }],
  }),
  component: () => <LegalPage title="Privacy Policy" sections={sections} />,
});

const sections = [
  {
    title: "1. Scope and operator",
    paragraphs: [
      "This policy explains how the independent operator of CanvasPro handles information through canvaspro.app, its installed web app, mobile app, and related services. Contact support@canvaspro.app for privacy requests. CanvasPro is independent of Instructure, Canvas LMS, and your school; their services have separate privacy policies.",
      "This notice describes data handling; accepting it does not waive your privacy rights or provide blanket consent to unrelated optional processing.",
    ],
  },
  {
    title: "2. Account, profile, and agreement information",
    paragraphs: [
      "We process your email address, account identifier, authentication information, first and last name, and any username, nickname, profile image, school, major, or graduation year you provide. Some profile fields are optional. Supabase provides account authentication and session management.",
      "We store your self-confirmation that you are at least 13, its time and version, and the policy versions and timestamp associated with your agreement. We do not request a birth date or identity document for the age checkbox. These confirmations are not independent age verification.",
      "When you contact support, we receive your message, contact details, attachments you choose to send, and information needed to resolve the issue. Do not send passwords or Canvas API keys by email.",
    ],
  },
  {
    title: "3. Canvas credentials and academic information",
    paragraphs: [
      "When you connect Canvas, we receive your institution’s Canvas address and personal API access token. The saved token is available to authorized server components so they can make authenticated requests on your behalf, including background notification checks. It is not end-to-end encrypted from CanvasPro’s backend, and this policy does not promise that the operator is technically unable to access it.",
      "Depending on what your institution exposes and the features you use, we retrieve courses, course codes, enrollments, assignments, due dates, submission status, scores, grade details and weights, syllabus information, announcements, and calendar information. Data may be temporarily cached on servers and on your device to improve loading and support recent views.",
      "We also process preferences and information you create in CanvasPro: hidden courses, course nicknames, schedules, assignment completion flags, priorities and time estimates, daily-plan choices, study-session state, dashboard widgets, and appearance settings. Some state is stored on your device; account-backed preferences are stored on our backend.",
    ],
  },
  {
    title: "4. Usage measurement and technical information",
    paragraphs: [
      "We record account-linked activity dates, last-seen times, and periodic activity counts to understand daily, weekly, and monthly use. Authorized administrators can see aggregate totals and a recent-activity list that includes an account email or identifier, last-seen time, and counts. These counts are approximate activity measures, not a recording of every click or an exact measure of time spent studying.",
      "Our infrastructure and service providers may process IP addresses, browser or device information, request times, security and authentication logs, and error details. Error reporting can include the current route and diagnostic context. We use this information to operate, troubleshoot, secure, and improve the app and to detect abuse.",
    ],
  },
  {
    title: "5. Device storage and notifications",
    paragraphs: [
      "We use browser or app storage for login sessions, account-scoped cached Canvas results, settings, plan and study state, and related functionality. Service workers cache app resources for installed-web-app operation. This is first-party functional storage and usage measurement; the app does not currently use advertising trackers or sell personal information for targeted advertising.",
      "Clearing browser storage may sign you out and remove locally stored preferences or unsynced data. Signing out clears account-scoped storage on that device, but does not remove data on other devices, downloaded files, operating-system backups, or information already sent elsewhere.",
      "If you enable notifications, we process push subscription endpoints, delivery keys or device tokens where applicable, browser/device details, reminder preferences, scheduled-alert information, and delivery records. Push providers route messages to your device. Notification text can contain assignment titles, courses, deadlines, or grade/announcement information and may appear on your lock screen. You can change permissions in the app and device settings.",
    ],
  },
  {
    title: "6. Why we use information",
    paragraphs: [
      "We use information to authenticate you, connect to Canvas, display and organize academic information, calculate estimates, save preferences, deliver requested reminders and account emails, provide support, measure service use, diagnose problems, prevent abuse, and meet legal obligations.",
      "We do not sell your personal or academic information or share it for cross-context behavioral advertising. Academic data is used for the service’s productivity functions, not to make official educational decisions. We do not claim to be your institution’s designated school official or to provide an institutional records system.",
    ],
  },
  {
    title: "7. Who receives information",
    paragraphs: [
      "Service providers process information as needed to operate the app: Supabase for authentication, databases, and storage; hosting and development infrastructure such as Cloudflare and Lovable; email-delivery services for account messages; and the push service associated with your browser or device for notifications. Your institution’s Canvas service receives authenticated requests using your token. Providers’ processing is also governed by their applicable terms and privacy notices.",
      "If you have an existing billing relationship, Stripe processes payment information and we process related customer or subscription identifiers and billing status. Payment credentials are entered with the payment provider; CanvasPro does not collect your full payment-card number through its own forms.",
      "Authorized personnel may access information when needed for administration, support, troubleshooting, or security. We may disclose information to comply with valid legal process, protect rights and safety, investigate fraud, or carry out a business transfer subject to applicable privacy requirements. We may also disclose information when you direct us to do so. Other students are not given access to your account’s private academic data through the app.",
      "The public website links to optional Google Forms for problem reports and surveys. If you choose to open or submit one of those forms, Google and the form owner receive the information you submit and technical information described by Google’s privacy terms. Do not include a password, Canvas API token, or academic record in those forms.",
    ],
  },
  {
    title: "8. Retention and deletion",
    paragraphs: [
      "We retain account information and saved preferences while needed to provide your account, with additional retention where reasonably necessary for security, disputes, billing, or legal obligations. Canvas caches are temporary and may be refreshed or expire. Retention varies by category and provider; we do not promise a single deletion period for all systems.",
      "You can delete your account in Settings or request help at support@canvaspro.app. Account deletion removes the authentication account and associated app records through deletion and database relationships. Limited records may remain in backups, provider logs, legal holds, or records that must be retained by law until their applicable retention period ends. Deletion does not remove your institution’s Canvas records.",
      "Removing a saved key stops future use of that saved key after the change takes effect; requests already in progress, cached results, or queued notifications may persist temporarily. Revoke the token in Canvas to invalidate it at its source. Removing a key is not the same as deleting your account. Cancel any existing billing subscription separately through the billing portal or contact support.",
    ],
  },
  {
    title: "9. Security",
    paragraphs: [
      "We use authenticated access, account-scoped storage, database access controls, and transport security to help protect information. No service or transmission method is completely secure. We do not guarantee that unauthorized access, data loss, or security incidents can never occur.",
      "Protect your device and login credentials, avoid shared-device sessions, revoke exposed Canvas tokens, and report suspected incidents to support. We will provide notices of data incidents where required by applicable law.",
    ],
  },
  {
    title: "10. Your choices and privacy requests",
    paragraphs: [
      "You can edit available profile fields and preferences in Settings, remove a Canvas key, revoke it at Canvas, manage notification permissions, clear device storage, and delete your account. For information not accessible through those controls, contact support@canvaspro.app.",
      "Depending on where you live and which laws apply, you may have rights to access, correct, delete, or receive a portable copy of personal information; restrict or object to processing; withdraw consent for consent-based processing; or appeal a denied request. We assess requests under applicable law and may need proportionate identity verification. We will explain any lawful restriction on a request. We do not require you to provide your password or Canvas token to make a request.",
      "Where available, you can authorize an agent and complain to your privacy regulator. Withdrawing optional consent does not affect earlier lawful processing. Agreeing to our Terms or this policy does not remove statutory privacy rights.",
      "Browser privacy signals: CanvasPro does not currently sell personal information or share it for cross-context behavioral advertising, and it does not use third-party advertising trackers. Because there is no sale or targeted-advertising sharing to opt out of, Global Privacy Control and legacy Do Not Track signals do not change the app’s necessary account, security, or service operation. If these practices change, we will update this notice and honor legally required opt-out signals.",
      "Third parties may collect information when you deliberately leave CanvasPro for an external service, such as Canvas, Stripe, or an optional Google Form. CanvasPro does not authorize those services to track your activity across unrelated websites on our behalf for advertising.",
    ],
  },
  {
    title: "11. International processing",
    paragraphs: [
      "CanvasPro and its providers may process information in the United States and other countries where their systems operate. Privacy laws may differ from those in your location. Where applicable law requires transfer safeguards or a legal basis for processing, those requirements continue to apply.",
      "Where applicable, processing needed to provide an account and requested features is based on service performance; security, troubleshooting, and proportionate usage measurement on legitimate interests where permitted; compliance on legal obligations; and optional consent-based features on consent. Contact support for questions about your particular location or the safeguards applicable to a request.",
    ],
  },
  {
    title: "12. Children and teenagers",
    paragraphs: [
      "CanvasPro is intended for people aged 13 and older, primarily college students. Children under 13 are not permitted to create accounts or use the service. Users below the age of legal adulthood need a parent or guardian’s permission and must satisfy any higher local age or consent requirements.",
      "We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided personal information, contact support@canvaspro.app. We will investigate and take appropriate steps to stop collection and delete the information as required by law. A parent’s report is not ignored merely because an account checked the age-confirmation box.",
    ],
  },
  {
    title: "13. Updates and contact",
    paragraphs: [
      "We show the effective version date above. We will communicate material changes through the app or account contact information and obtain additional consent where required before materially different uses of previously collected information. The published policy does not override applicable law.",
      "Send privacy questions, requests, or concerns to support@canvaspro.app. Our Terms of Use separately address service use, eligibility, and responsibilities.",
    ],
  },
];
