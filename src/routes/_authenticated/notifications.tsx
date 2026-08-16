import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/glass-card";
import { NotificationSettings } from "@/components/notification-settings";
import { UpgradeCard } from "@/components/pro-gate";
import { useSubscription } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Settings — Canvas Pro" },
      {
        name: "description",
        content:
          "Choose when Canvas Pro notifies you and which events — assignment due dates, new grades, and announcements.",
      },
      { property: "og:title", content: "Notification Settings — Canvas Pro" },
      {
        property: "og:description",
        content:
          "Pick your due-date reminders, grade alerts, announcement alerts, and quiet hours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { isActive: isPro } = useSubscription();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose when you get notified and which events you care about.
        </p>
      </header>

      <GlassCard
        title="Your alerts"
        subtitle="Due-date reminders, grades, announcements, and quiet hours."
      >
        {isPro ? <NotificationSettings /> : <UpgradeCard feature="Notifications" />}
      </GlassCard>
    </div>
  );
}
