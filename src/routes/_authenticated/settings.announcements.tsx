import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/glass-card";
import { AnnouncementWindowSection } from "@/components/settings-sections";
import { SettingsPage } from "@/components/settings-page";

export const Route = createFileRoute("/_authenticated/settings/announcements")({
  head: () => ({ meta: [
    { title: "Announcement Settings — CanvasPro" },
    { name: "description", content: "Choose how far back Canvas announcements appear in CanvasPro." },
    { property: "og:title", content: "Announcement Settings — CanvasPro" },
    { property: "og:description", content: "Choose how far back Canvas announcements appear in CanvasPro." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AnnouncementSettingsPage,
});

function AnnouncementSettingsPage() {
  return <SettingsPage title="Announcements" description="Choose how much announcement history you want to see."><GlassCard title="Announcement history" subtitle="How far back the announcements list reaches."><AnnouncementWindowSection /></GlassCard></SettingsPage>;
}