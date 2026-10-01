import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/glass-card";
import { SettingsPage } from "@/components/settings-page";
import {
  NotificationCountdowns,
  NotificationDelivery,
  NotificationMasterSwitch,
  NotificationTriggers,
} from "@/components/notification-settings";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({ meta: [
    { title: "Notification Settings — CanvasPro" },
    { name: "description", content: "Choose CanvasPro alerts, reminders, delivery, and quiet hours." },
    { property: "og:title", content: "Notification Settings — CanvasPro" },
    { property: "og:description", content: "Choose CanvasPro alerts, reminders, delivery, and quiet hours." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: NotificationSettingsPage,
});

function NotificationSettingsPage() {
  return (
    <SettingsPage title="Notifications" description="Decide what Canvas activity is worth an alert and when it can reach you.">
      <GlassCard strong title="Notifications" subtitle="One switch for everything below."><NotificationMasterSwitch /></GlassCard>
      <GlassCard title="1 · What triggers an alert" subtitle="Due dates, grades and announcements."><NotificationTriggers /></GlassCard>
      <GlassCard title="2 · Countdowns" subtitle="Next class starting, and tonight's 11:59 PM deadlines."><NotificationCountdowns /></GlassCard>
      <GlassCard title="3 · How &amp; when they reach you" subtitle="Pop-ups, alerts with the site closed, quiet hours."><NotificationDelivery /></GlassCard>
    </SettingsPage>
  );
}