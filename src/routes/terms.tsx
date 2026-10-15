import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { PLANS, REFUND_WINDOW_DAYS, TRIAL_DAYS } from "@/lib/billing";
import { sellerIdentity } from "@/lib/legal-consent";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — CoursePro" },
      {
        name: "description",
        content:
          "Eligibility, responsibilities, service limitations, and legal terms for CoursePro.",
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
      `These Terms of Use are an agreement between you and ${sellerIdentity()} (“CoursePro,” “we,” “us”), reachable at support@canvaspro.app; you contract with us. They govern canvaspro.app, the installed web app, the mobile app, and related account services. By selecting the agreement checkbox when creating an account, signing in, or subscribing, or by selecting “I agree” when we present updated Terms, you accept these Terms and acknowledge the data practices described in the Privacy Policy. If you do not agree, do not create an account or sign in.`,
      "PLEASE READ SECTION 13 CAREFULLY. IT REQUIRES MOST DISPUTES TO BE RESOLVED BY BINDING INDIVIDUAL ARBITRATION, NOT IN COURT, AND WAIVES CLASS ACTIONS AND JURY TRIALS. YOU CAN OPT OUT OF ARBITRATION WITHIN 30 DAYS AS SECTION 13 EXPLAINS.",
      "Our name changed. CoursePro was previously called CanvasPro. Only the name changed: the same company provides the same service at the same web address (canvaspro.app), and your account, any subscription, and your rights under these Terms continue unchanged.",
      "CoursePro is not affiliated with, sponsored by, endorsed by, or officially connected to Instructure, Inc., Canvas LMS, or your educational institution. Canvas and Canvas LMS are their owners’ trademarks. References identify compatibility only.",
    ],
  },
  {
    title: "2. Eligibility: age 18 and older",
    paragraphs: [
      "You must be at least 18 years old and able to form a binding contract to create an account or use CoursePro. The age checkbox is your confirmation; it is not independent identity or age verification. Children under 13 may never use the service, including with a parent’s account or permission. Do not submit personal information about a child under 13.",
      "Accounts created before October 12, 2026 by people aged 13 to 17 with a parent or legal guardian’s permission, as our earlier terms allowed, may continue. For those accounts, the parent or guardian remains responsible for supervising use and accepts these Terms on the account holder’s behalf, and the holder must also meet any higher age or consent requirement where they live.",
      "You must have authority to access the school account and records you connect. A school account does not by itself establish permission to use third-party software.",
    ],
  },
  {
    title: "3. The service and academic responsibility",
    paragraphs: [
      "CoursePro organizes Canvas courses, assignments, deadlines, grades, announcements, calendars, and user-entered schedules. It also offers Focus, Today’s Plan, workload estimates, study sessions, widgets, and reminders. Features and compatibility can change.",
      "Your institution’s Canvas portal, syllabus, instructors, and official records remain authoritative. Check them directly for deadlines, time zones, submission requirements, extensions, grade changes, and emergencies. Cached data can be incomplete or out of date, and app calculations or displays can contain errors.",
      "Marking an item complete, starting a study session, or opening an assignment in CoursePro does not submit coursework to Canvas, change an instructor’s deadline, or earn academic credit. Recommended tasks, duration estimates, priorities, and study plans are organizational estimates, not academic advice or promises of grades, admission, graduation, or results.",
    ],
  },
  {
    title: "4. Accounts and Canvas access",
    paragraphs: [
      "Provide accurate account information, protect your credentials and devices, and promptly report suspected unauthorized access. Do not share, sell, or transfer accounts or use someone else’s Canvas token. You are responsible for your authorized use and for reasonable care of your credentials; this clause does not shift responsibility for our legal obligations to you.",
      "By connecting Canvas, you authorize us to store and use the token and institution address you provide to retrieve permitted data and operate features you enable, including background reminders. Use only tokens you are authorized to provide and comply with your institution’s rules and Canvas’s applicable terms.",
      "You can remove the saved key in Settings and revoke the token in Canvas. Revocation prevents future successful token use, but does not recall information already retrieved or notifications already sent. A token may provide broader access than the features CoursePro uses, so keep it confidential.",
    ],
  },
  {
    title: "5. Acceptable use and service protection",
    paragraphs: [
      "Use CoursePro for lawful, personal productivity. Do not access other users’ records, probe or bypass authentication or rate limits, exploit vulnerabilities, distribute malware, impersonate others, infringe intellectual property or privacy rights, or harass people through the service.",
      "Do not scrape, resell, bulk-export other users’ information, automate excessive requests, evade sync cooldowns, or intentionally increase infrastructure costs. These restrictions do not prohibit assistive technologies or conduct that applicable law expressly permits.",
      "We may limit requests or restrict access when reasonably necessary to protect users, comply with law, investigate abuse, or maintain service availability. You may report vulnerabilities privately to support@canvaspro.app; do not access or retain other users’ data to demonstrate a problem.",
    ],
  },
  {
    title: "6. Your content and our intellectual property",
    paragraphs: [
      "You retain rights you hold in your profile, schedules, notes, and other content you provide. You give CoursePro a limited, nonexclusive permission to host, copy, process, and display that content only to operate, secure, support, and improve the service as described in the Privacy Policy. This does not transfer ownership of academic records or authorize public publication of private content.",
      "You must have the rights needed for information you upload or connect. CoursePro’s original software, design, branding, and content belong to their respective owners. We grant you a limited, personal, nonexclusive, nontransferable right to use the service while you comply with these Terms. Third-party and open-source components remain subject to their licenses.",
    ],
  },
  {
    title: "7. Notifications, integrations, and availability",
    paragraphs: [
      "Notifications depend on your settings, device permissions, operating system, network, browser, installation method, and external services. They can be delayed, duplicated, missing, or displayed on a lock screen. Background delivery and timers are not guaranteed when an app or device is closed, offline, suspended, or in a battery-saving mode. Maintain your own deadline reminders.",
      "Canvas, hosting, email, and device services are outside our direct control and have their own terms. Their outages, API changes, token revocation, school restrictions, and maintenance can interrupt CoursePro. We do not promise continuous availability, a particular response time, indefinite support, or preservation of every feature.",
    ],
  },
  {
    title: "8. Subscriptions, free trial, billing, and refunds",
    paragraphs: [
      `Price. CoursePro is a paid subscription: US ${PLANS.monthly.price} per month or US ${PLANS.yearly.price} per year, plus any applicable sales tax, VAT, or similar taxes. The price, billing frequency, and taxes are shown before you buy. Without an active free trial or subscription, the service is limited to account settings, billing, and account deletion.`,
      "Merchant of Record. Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns. Your purchase is also governed by Paddle’s Buyer Terms at paddle.com/legal/checkout-buyer-terms, and payments are processed by Paddle, not by CoursePro.",
      `Free trial. New subscribers can take one ${TRIAL_DAYS}-day free trial per person. You add a payment method to start it. Unless you cancel before the trial ends, your subscription starts automatically and you are charged the price of the plan you chose on the day the trial ends. We email you at least 7 days before that first charge. Accounts created before paid subscriptions launched receive ${TRIAL_DAYS} days of free access from launch instead of a trial; if they subscribe during those days, the first charge waits until those days end.`,
      "Automatic renewal. Your subscription renews automatically at the end of each monthly or yearly period, and you authorize Paddle to charge your payment method for each renewal at the then-current price until you cancel. For yearly plans we email a reminder about 30 days before each renewal.",
      "Canceling. You can cancel online at any time in Settings → Billing, or through Paddle at paddle.net. Cancellation takes effect at the end of your current trial or paid period: you keep access until then and are not charged again. Canceling does not by itself refund earlier charges.",
      "Changing plans and prices. You can switch from monthly to yearly at any time. Paddle credits the unused part of your current month and charges the prorated difference right away; the amount is shown before you confirm. During a free trial, switching charges nothing until the trial ends. We will give you at least 30 days’ notice of a price increase before it applies to your next renewal, and you can cancel before it does.",
      "Failed payments. If a renewal payment fails, Paddle retries it for a period and your access continues meanwhile. If the payment still cannot be collected, the subscription ends and access is limited until you subscribe again.",
      `Refunds. You may request a refund for any reason within ${REFUND_WINDOW_DAYS} days of a charge, as explained in our Refund Policy at canvaspro.app/refund-policy. Refunds are not available for charges more than ${REFUND_WINDOW_DAYS} days old, except where the law requires otherwise. Nothing in these Terms limits rights you have under consumer protection law.`,
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
      "To the maximum extent permitted by law, our total aggregate liability for claims arising from the service or these Terms will not exceed the greater of US $100 or the amount you paid to CoursePro during the 12 months before the event giving rise to the claim.",
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
      "We may suspend or terminate access for material violations, non-payment, fraud, security risks, legal requirements, or discontinuation of the service. Where reasonably practicable, we will provide notice and an opportunity to address the issue; urgent security or legal circumstances may require immediate action. Contact support to ask us to review a restriction.",
      "You may stop using CoursePro, revoke Canvas access, or delete your account in Settings. Deletion and retention are addressed in the Privacy Policy. Keep independent copies of information you need. Provisions concerning intellectual property, liability, disputes, and obligations intended to survive remain effective after account closure, subject to applicable law.",
    ],
  },
  {
    title: "13. Disputes, arbitration, and class-action waiver",
    paragraphs: [
      "Governing law. The Federal Arbitration Act governs this Section 13. Otherwise, Michigan law governs these Terms, excluding its conflict-of-laws rules, except that mandatory consumer protections of the place where you live continue to apply.",
      "Try to resolve it first. Before starting arbitration or a court case, the party with a dispute must send the other a written notice describing it and the relief sought. Send yours to support@canvaspro.app with your name and account email; we will send ours to your account email. Both sides will try in good faith to resolve the dispute for 30 days after the notice is received. Deadlines to file a claim are paused during those 30 days.",
      "Binding individual arbitration. If the dispute is not resolved, you and CoursePro agree that any dispute, claim, or controversy arising out of or relating to these Terms, the Privacy Policy, or the service, including its formation, scope, or validity, will be resolved by binding individual arbitration rather than in court, except as stated below. The American Arbitration Association (AAA) will administer it under its Consumer Arbitration Rules before a single arbitrator. You may choose to have the hearing by phone or video, on written submissions, or in the county where you live. The arbitrator may award the same individual relief a court could, and the award may be entered in any court with jurisdiction.",
      "Costs. For claims you bring, we will pay the filing, administrative, and arbitrator fees that the AAA Consumer Arbitration Rules assign to the business. Each side pays its own attorneys’ fees unless the law or the rules allow the arbitrator to award them.",
      "Exceptions. Either side may instead bring an individual claim in small-claims court if it qualifies. Either side may ask a court for an order to stop infringement or misuse of intellectual property or unauthorized access to the service. Nothing here stops you from reporting a concern to a government agency.",
      "CLASS-ACTION AND JURY-TRIAL WAIVER. YOU AND CANVASPRO EACH WAIVE THE RIGHT TO A JURY TRIAL AND AGREE TO BRING CLAIMS ONLY IN AN INDIVIDUAL CAPACITY, NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY CLASS, COLLECTIVE, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. The arbitrator may not combine more than one person’s claims and may award relief only to the individual party and only as needed for that party’s claim. If a court decides that this waiver cannot be enforced for a particular claim or remedy, that claim or remedy, and only that one, will be decided by a court in Michigan after any arbitration of the remaining claims, and not in arbitration.",
      "Mass filings. If 25 or more similar demands for arbitration are filed against CoursePro by or with the help of the same or coordinated counsel, the AAA Mass Arbitration Supplementary Rules apply, and the demands may be administered and decided in batches. The parties will cooperate in good faith to resolve them efficiently.",
      "30-day right to opt out. You may opt out of arbitration and the class-action waiver by emailing support@canvaspro.app within 30 days after you first accept these Terms, or within 30 days after you accept a version that first adds this Section 13, with your name, your account email, and a clear statement that you opt out of arbitration. Opting out does not affect any other part of these Terms.",
      "Courts. Any dispute not decided in arbitration or small-claims court will be heard only in the state or federal courts located in Michigan, and you and CoursePro consent to their jurisdiction, except where the law of the place you live gives you a right to sue there. For accounts held by minors under our earlier terms, this Section 13 applies only to the extent the law allows it to bind them.",
    ],
  },
  {
    title: "14. Changes and general provisions",
    paragraphs: [
      "We will identify revisions by the updated date. Material changes will be communicated through the service or account contact information, and renewed agreement will be requested where required. Changes do not retroactively waive existing claims or authorize materially different uses of previously collected data without any consent required by law.",
      "A change to Section 13 applies only to disputes that arise after you accept it. Until you accept an updated version of these Terms, the version you last accepted continues to apply to you. If you do not accept a future change to Section 13, the version of Section 13 you last accepted continues to apply to disputes between us.",
      "If a provision is unenforceable, it will be limited or severed to the extent necessary and the remaining provisions continue where lawful. Failure to enforce a provision is not a waiver. These Terms and expressly agreed feature-specific terms form the agreement about service use; the Privacy Policy explains data handling and does not waive privacy rights.",
      "Questions, account concerns, legal notices, and complaints may be sent to support@canvaspro.app.",
    ],
  },
];
