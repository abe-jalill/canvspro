import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/glass-card";
import {
  NotificationCountdowns,
  NotificationDelivery,
  NotificationMasterSwitch,
  NotificationTriggers,
} from "@/components/notification-settings";
import { useSubscription } from "@/lib/subscription";
import { UpgradeCard } from "@/components/pro-gate";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Settings — Canvas Pro" },
      {
        name: "description",
        content:
          "Choose exactly which Canvas events trigger alerts: due-date lead times, grade thresholds, announcements, browser pop-ups, and quiet hours.",
      },
      { property: "og:title", content: "Notification Settings — Canvas Pro" },
      {
        property: "og:description",
        content:
          "Choose exactly which Canvas events trigger alerts: due-date lead times, grade thresholds, announcements, browser pop-ups, and quiet hours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsSettingsPage,
});

function NotificationsSettingsPage() {
  const { isActive: isPro } = useSubscription();

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="px-1 pt-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Alerts
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
          Notifications
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Decide what Canvas activity is worth an alert — and when it's allowed
          to reach you.
        </p>
      </header>

      {isPro ? (
        <>
          <GlassCard strong title="Notifications" subtitle="One switch for everything below.">
            <NotificationMasterSwitch />
          </GlassCard>

          <GlassCard
            title="1 · What triggers an alert"
            subtitle="Due dates, grades and announcements."
          >
            <NotificationTriggers />
          </GlassCard>

          <GlassCard
            title="2 · Countdowns"
            subtitle="Next class starting, and tonight's 11:59 PM deadlines."
          >
            <NotificationCountdowns />
          </GlassCard>

          <GlassCard
            title="3 · How &amp; when they reach you"
            subtitle="Pop-ups, alerts with the site closed, quiet hours."
          >
            <NotificationDelivery />
          </GlassCard>

          <p className="px-1 text-xs text-muted-foreground">
            Looking for your Canvas key or class names?{" "}
            <Link to="/settings" className="underline underline-offset-4">
              Open Settings
            </Link>
            .
          </p>
        </>
      ) : (
        <UpgradeCard feature="Notifications" />
      )}
    </div>
  );
}
