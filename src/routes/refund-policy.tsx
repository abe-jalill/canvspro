import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { REFUND_WINDOW_DAYS, TRIAL_DAYS } from "@/lib/billing";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — CoursePro" },
      {
        name: "description",
        content: `CoursePro refunds: request one within ${REFUND_WINDOW_DAYS} days of a charge. How to cancel and how to ask for a refund.`,
      },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/refund-policy" }],
  }),
  component: () => <LegalPage title="Refund Policy" sections={sections} />,
});

const sections = [
  {
    title: `1. ${REFUND_WINDOW_DAYS}-day refunds`,
    paragraphs: [
      `You can ask for a full refund of any CoursePro charge, for any reason, within ${REFUND_WINDOW_DAYS} days of the date you were charged. This includes the first charge after a free trial and each monthly or yearly renewal.`,
      `Refunds are not available for charges more than ${REFUND_WINDOW_DAYS} days old, except where the law where you live requires otherwise. Your statutory consumer rights are not affected by this policy.`,
    ],
  },
  {
    title: "2. How to request a refund",
    paragraphs: [
      "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle handles refunds. Request a refund at paddle.net, where you can look up your order with the email address you used, or email support@canvaspro.app with that email address and the date of the charge and we will pass it to Paddle.",
      "Approved refunds go back to the original payment method. Your bank or card issuer may take several business days to show it.",
    ],
  },
  {
    title: "3. Free trial and canceling",
    paragraphs: [
      `The ${TRIAL_DAYS}-day free trial costs nothing. Cancel before it ends, in Settings → Billing, and you will not be charged at all.`,
      "You can cancel a subscription at any time. Canceling stops future renewals; you keep access until the end of the period you already paid for. Canceling on its own does not refund an earlier charge — to get one back, request a refund within the window above.",
    ],
  },
  {
    title: "4. Questions",
    paragraphs: [
      "Email support@canvaspro.app with any question about a charge. Our Terms of Use (Section 8) describe subscriptions, renewals, and cancellation in full.",
    ],
  },
];
