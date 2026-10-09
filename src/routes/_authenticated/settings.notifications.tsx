import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/glass-card";
import { SettingsPage } from "@/components/settings-page";
import { NotificationSettings } from "@/components/notification-settings";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Settings — CanvasPro" },
      {
        name: "description",
        content: "Choose CanvasPro alerts, reminders, delivery, and quiet hours.",
      },
      { property: "og:title", content: "Notification Settings — CanvasPro" },
      {
        property: "og:description",
        content: "Choose CanvasPro alerts, reminders, delivery, and quiet hours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationSettingsPage,
});

function NotificationSettingsPage() {
  return (
    <SettingsPage title="Notifications" description="Choose what you hear about.">
      <GlassCard strong>
        <NotificationSettings />
      </GlassCard>
    </SettingsPage>
  );
}
