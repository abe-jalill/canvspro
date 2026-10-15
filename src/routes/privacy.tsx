import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalHighlight, type LegalSection } from "@/components/legal-page";
import { SELLER_ADDRESS, sellerIdentity } from "@/lib/legal-consent";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — CoursePro" },
      {
        name: "description",
        content:
          "What CoursePro collects, why, who receives it, how long it is kept, and the privacy rights every US user has.",
      },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/privacy" }],
  }),
  component: () => (
    <LegalPage title="Privacy Policy" intro={intro} highlights={highlights} sections={sections} />
  ),
});

const intro =
  "CanvasPro helps students see their Canvas courses, deadlines, and grades in one place. To do that, it handles personal and academic information. This policy explains what we collect, why, who receives it, how long it is kept, and the rights you have.";

const highlights: LegalHighlight[] = [
  {
    title: "We do not sell your data",
    body: "We do not sell or share personal or academic information for advertising, and the app has no advertising trackers. We measure ads only with our own campaign tags.",
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
    title: "Your rights, wherever you live",
    body: "Every US user can access, correct, delete, or export their information. Delete your account in Settings at any time.",
  },
];

const sections: LegalSection[] = [
  {
    title: "1. Who we are and what this covers",
    paragraphs: [
      `This Privacy Policy explains how ${sellerIdentity()}, based in Michigan, United States${SELLER_ADDRESS ? ` (mailing address: ${SELLER_ADDRESS})` : ""} (“CoursePro,” “we,” “us”), the controller of your personal information, collects, uses, discloses, keeps, and protects personal information through canvaspro.app, the installed web app, the mobile app, and related services (the “service”). It is also our notice at collection: it tells you, before or when we collect information, what we collect and why.`,
      "Our name changed. CoursePro was previously called CanvasPro. Only the name changed: the same company handles your information in the same way, at the same web address (canvaspro.app), and nothing about what we collect or how we use it changed with the name.",
      "CoursePro is independent of Instructure, Canvas LMS, and your school. Their services have their own privacy policies. Contact support@canvaspro.app with any privacy question or request.",
      "Accepting this policy does not waive any privacy right you have by law, and it is not blanket consent to optional processing that this policy does not describe.",
    ],
  },
  {
    title: "2. What we collect",
    paragraphs: [
      "Account and agreement information. Your email address, account identifier, first and last name, and any username, nickname, profile image, school, major, or graduation year you choose to add. We also keep your confirmation that you are at least 18 (or, for accounts made before October 12, 2026, at least 13), when you gave it, which version of the confirmation you saw, and which versions of the Terms and this policy you accepted and when. You provide this. We keep it until you delete your account.",
      "Login credentials (sensitive personal information). Your password is handled by our authentication provider, Supabase, which stores it in hashed form; we cannot read it. When you connect Canvas, we store your school’s Canvas address and the personal access token you create there. The token is available to our server so it can request your Canvas data, including for background reminders. Once saved, it cannot be read back by browsers or the app. It is not end-to-end encrypted from our backend. We use these credentials only to sign you in and to provide the features you use, never for any other purpose. We keep the token until you remove it in Settings or delete your account.",
      "Education information from Canvas. Depending on what your school makes available and the features you use, we retrieve courses, course codes, enrollments, assignments, due dates, submission status, scores, grade details and weights, syllabus information, announcements, and calendar items through your token. This information is cached temporarily on our servers and your device to load pages quickly, and it is refreshed or expires as you use the service. We also keep a dated record of your course scores so the app can show how your grades change over time; it is kept until you delete your account.",
      "Information you create. Hidden courses, course nicknames, class schedules, completion check marks, priorities and time estimates, daily-plan choices, study-session state, dashboard layout, and appearance settings. Some of it stays only on your device; account-backed items are stored on our backend until you change them or delete your account.",
      "Usage activity. The days you used the service, your last-seen time, and approximate activity counts. These are not a record of every click. We keep them for as long as your account exists.",
      "Campaign source. If you arrive through a link that carries campaign tags, the tags, the page you landed on, the name of the website that sent you, and the time. Section 4 explains exactly how this works. We keep it with your account for as long as your account exists.",
      "Device and technical information. Our hosting and infrastructure providers process IP addresses, browser and device details, request times, security and authentication logs, and error details, which can include the page you were on. These logs are kept for limited periods under our providers’ log schedules.",
      "Notification information. If you turn on notifications: push subscription endpoints, delivery keys or device tokens, browser or device details, reminder preferences, scheduled alerts, and delivery records. We keep device registrations and reminder preferences until you turn notifications off, the device stops accepting them, or you delete your account. Records of which alerts were sent are deleted after about 14 days, and queued reminders after 3 days.",
      "Support messages. What you send us, your contact details, and attachments you choose to include. We keep them only as long as needed to handle your request and any follow-up, and to keep a record of how it was resolved, and we delete them when they are no longer needed for that. Never send a password or Canvas token by email.",
      "Billing information. If you subscribe, Paddle, our online reseller and Merchant of Record, collects your name, email address, billing country and postal code, and payment details directly in its checkout. We never see or store your full card number. Paddle tells us your Paddle customer and subscription identifiers, your plan, your subscription status, your trial, renewal, and cancellation dates, and whether a payment failed. We use this to give you access, send trial and renewal reminders, and answer billing questions. We keep it while you have an account and delete our copy when you delete your account; Paddle keeps its own order and payment records as tax and accounting laws require, under its privacy notice. Our former payment provider, Stripe, keeps records of payments made before October 12, 2026 under its own privacy policy and legal obligations.",
      "What we do not collect. We do not collect precise location, biometric information, health information, government identification numbers, or financial account or card numbers.",
    ],
  },
  {
    title: "3. How we use information",
    paragraphs: [
      "We use information to create and secure your account, connect to Canvas, display and organize your coursework, calculate estimates and plans, save your preferences, provide subscriptions and free trials and send the billing reminders they require, send the reminders and account emails you ask for, answer support requests, measure how the service is used and which campaigns bring new accounts, find and fix problems, prevent fraud and abuse, and meet legal obligations.",
      "We do not sell personal information. We do not share it for cross-context behavioral advertising, use it for targeted advertising, or use it for profiling that produces legal or similarly significant effects. We make no automated decisions about you with legal or similarly significant effects. Your academic information is used only for the service’s productivity features, never to make official educational decisions. We handle it at your direction as a student using your own account; CoursePro is not your school’s “school official” under FERPA and is not its records system.",
      "If we ever want to use personal information for a purpose that is materially different from those described here, we will tell you first and ask for your consent where the law requires it.",
    ],
  },
  {
    title: "4. How we measure ads and links",
    paragraphs: [
      "Ads and links to CoursePro can carry campaign tags in the web address (utm_source, utm_medium, utm_campaign, utm_content, and utm_term). When you open such a link, our website saves those tags, the page you landed on, the name of the website that sent you (not its full address), and the time in your browser’s local storage for up to 30 days. If you create an account during that time, this information is saved with your account and removed from the browser.",
      "This measurement is entirely our own. We do not use advertising pixels, third-party advertising cookies, or advertising software development kits; we do not store ad-platform click identifiers; and we do not send this information to any advertising platform. We review it only as totals, such as how many accounts each campaign brought and how many of them connected Canvas.",
      "The advertising platform that showed you an ad may separately know that you clicked it, under that platform’s own policies. You can remove a saved campaign from your browser by clearing site data, and you can ask us to delete the campaign information saved with your account.",
    ],
  },
  {
    title: "5. Device storage and notifications",
    paragraphs: [
      "We use browser and app storage for sign-in sessions, cached Canvas results, settings, plan and study state, and the campaign information described in Section 4. A service worker caches app files so the installed web app works offline. This is first-party, functional storage; we do not use advertising cookies or third-party tracking technologies.",
      "Clearing browser storage may sign you out and remove preferences or unsynced data on that device. Signing out clears account-specific storage on that device, but does not remove data on other devices, downloaded files, operating-system backups, or information already sent elsewhere.",
      "Push services operated by your browser or device maker deliver notifications to you. Notification text can include assignment titles, class names, deadlines, grades, or announcements and may appear on your lock screen. You can change notification permissions in CoursePro and in your device settings at any time.",
    ],
  },
  {
    title: "6. Who receives information",
    paragraphs: [
      "Service providers that process information on our behalf, only as needed to run the service and under terms that limit their use of it: Supabase (authentication, database, and storage), Cloudflare (hosting and network delivery), Lovable (development and hosting infrastructure), our email-delivery provider (account emails), and the push service of your browser or device (notifications). Your school’s Canvas service receives the requests we make with your token.",
      "Paddle.com, our online reseller and Merchant of Record, receives your email address and account identifier when you start a checkout, and processes your order, payment, taxes, invoices, refunds, and subscription. Paddle acts as an independent controller of the payment information it collects, under its own privacy notice at paddle.com/legal/privacy.",
      "Authorized personnel may access information when needed for administration, support, troubleshooting, or security. We may disclose information to comply with law or valid legal process, to protect the rights, property, and safety of users, the public, or CoursePro, to investigate fraud or abuse, at your direction, or as part of a merger, acquisition, or sale of the service, in which case this policy or equally protective terms will continue to apply to your information. Other users never receive your private academic data.",
      "AI assistants you connect. CoursePro offers an optional, read-only connection for AI assistants that support the Model Context Protocol. If you sign in and approve one on the consent screen, it can request your courses and grades, assignments and due dates, announcements, and calendar events, and what it receives is then governed by that assistant provider’s own terms and privacy policy, which we do not control. Connect only assistants you trust. You can revoke access in the assistant or by emailing support@canvaspro.app.",
      "The public website links to optional Google Forms for problem reports and surveys. If you open or submit one, Google and the form owner receive what you submit and technical information under Google’s privacy terms. Do not include a password, Canvas token, or academic record in those forms.",
      "In the past 12 months we have not sold or shared personal information, as those terms are defined in California and other state privacy laws. We disclosed the categories of personal information listed in Section 2 only to the service providers and other recipients described in this section, for the business purposes in Section 3.",
    ],
  },
  {
    title: "7. Keeping and deleting information",
    paragraphs: [
      "We keep each kind of information only as long as Section 2 states, or as long as reasonably necessary for the purposes in Section 3, unless a longer period is required by law or needed to resolve a dispute, enforce our agreements, or protect security.",
      "You can delete your account in Settings or by emailing support@canvaspro.app. Deleting your account removes your sign-in account and the records linked to it, including your Canvas token, preferences, schedules, grade history, activity history, campaign source, and notification registrations. It also cancels any subscription immediately, so you are not charged again, and removes our copy of your billing information; Paddle keeps its own order records as Section 2 describes. Copies may persist in encrypted backups and provider logs until those are overwritten on their regular schedule, and in records we must keep by law. Deletion does not remove your school’s Canvas records.",
      "Removing your Canvas key stops its future use once the change takes effect; requests already in progress, cached results, or queued notifications may remain briefly. Revoke the token in Canvas to invalidate it at its source.",
    ],
  },
  {
    title: "8. Security",
    paragraphs: [
      "We use authenticated access, per-account access rules in our database, encrypted connections, and limits on who can access data. No service or transmission is completely secure, and we cannot guarantee that unauthorized access, loss, or misuse will never happen.",
      "Protect your device and login, avoid shared-device sessions, revoke a Canvas token you think was exposed, and report suspected incidents to support@canvaspro.app. If a security incident affects your personal information, we will notify you and regulators as the laws of your state require.",
    ],
  },
  {
    title: "9. Your privacy rights",
    paragraphs: [
      "Residents of California, Colorado, Connecticut, Delaware, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah, Virginia, and other states with privacy laws have specific rights over their personal information. We extend the same rights to every user in the United States, whether or not a law requires it.",
      "Those rights are: to know what personal information we have about you, including the categories, sources, purposes, and recipients described in this policy; to get a copy of it in a portable format; to correct inaccurate information; to delete it; to opt out of the sale or sharing of personal information, targeted advertising, and profiling that produces legal or similarly significant effects; and to limit the use of sensitive personal information. We do not sell or share personal information, use it for targeted advertising or such profiling, or use sensitive personal information beyond what is needed to provide the service, so there is nothing to opt out of today; you may still ask, and if our practices ever change, your request will apply.",
      "You can use many of these rights yourself in Settings, where you can edit your profile, remove your Canvas key, manage notifications, and delete your account. For anything else, email support@canvaspro.app with the subject “Privacy request.” We verify requests by confirming you control the email address on the account, and we never ask for your password or Canvas token. You may use an authorized agent; we may ask the agent for your signed permission and confirm your identity directly with you.",
      "We respond within 45 days. If we need more time, we will tell you why within that period and may take up to 45 more days where the law allows. Requests are free, up to twice in any 12-month period; we may decline or charge a reasonable fee for requests that are manifestly unfounded or excessive, and we will explain why. We will never deny you the service, charge you differently, or provide a different quality of service because you used a privacy right.",
      "If we decline your request, you may appeal by replying with the subject “Appeal.” We will answer the appeal in writing within 45 days, or within any longer period your state permits, and explain our decision. If you disagree with the outcome, you may contact your state attorney general’s office of consumer protection.",
      "Global Privacy Control and Do Not Track. We treat a Global Privacy Control signal as a valid request to opt out of the sale and sharing of personal information and of targeted advertising, for that browser and, if you are signed in, for your account. Because we do neither, these signals do not change how the service works today. We do not respond differently to legacy Do Not Track signals, because we do not track you across other websites.",
    ],
  },
  {
    title: "10. Notices for specific states",
    paragraphs: [
      "California. In the past 12 months we collected these categories of personal information under the California Consumer Privacy Act: identifiers; customer records such as name and email; commercial information such as your subscription plan and billing history; non-public education information; internet or other electronic network activity; and sensitive personal information limited to account login credentials and the Canvas token. Sources, purposes, recipients, and retention periods are in Sections 2 through 7. We do not create inferences about you for profiling.",
      "California “Shine the Light.” We do not disclose personal information to third parties for their own direct marketing purposes.",
      "California minors. If you are under 18 and used CoursePro under an account made before October 12, 2026, you may ask us to remove content you posted to the service by emailing support@canvaspro.app. Removal may not ensure complete deletion where the content was copied or is kept by law.",
      "Nevada. We do not sell covered information as defined in Nevada law. Nevada residents may still send a request to support@canvaspro.app, and we will record it.",
      "Washington, Nevada, and other consumer health data laws. We do not collect consumer health data.",
      "Texas and other states with sensitive-data notice rules. We do not sell sensitive personal data or biometric data.",
    ],
  },
  {
    title: "11. Children and minors",
    paragraphs: [
      "New accounts are for people 18 and older. Before October 12, 2026, people aged 13 to 17 could create accounts with a parent or guardian’s permission, and those accounts may continue. We never sell or share information from those accounts, never use it for targeted advertising or profiling, and their holders, or their parents or guardians, can ask us to access or delete it at support@canvaspro.app.",
      "Children under 13 may not use CoursePro, and we do not knowingly collect personal information from them. If we learn that we have, we will delete it promptly as the Children’s Online Privacy Protection Act requires. If you believe a child under 13 has given us information, contact support@canvaspro.app. We do not ignore a parent’s report because an account checked an age box.",
    ],
  },
  {
    title: "12. Where information is processed",
    paragraphs: [
      "CoursePro is operated from the United States, and our providers process information in the United States and other countries where their systems run. If you use the service from outside the United States, your information is transferred to and processed in the United States, whose privacy laws may differ from yours. Where your local law requires a legal basis or transfer safeguards, we rely on providing the service you requested, our legitimate interests in security and proportionate measurement, legal obligations, and your consent where required.",
    ],
  },
  {
    title: "13. Changes to this policy",
    paragraphs: [
      "The dates at the top of this page show when this version took effect and when its wording was last updated. Clarifications that don't change our practices are made without asking you to agree again. If we make a material change, we will tell you in the app or by email before it takes effect and ask you to agree where the law requires. Changes never permit a materially different use of information we already collected without any consent the law requires.",
    ],
  },
  {
    title: "14. Contact",
    paragraphs: [
      "Send privacy questions, requests, appeals, and complaints to support@canvaspro.app. Our Terms of Use cover use of the service, eligibility, and how disputes are resolved.",
    ],
  },
];
