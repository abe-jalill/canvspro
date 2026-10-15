import { createFileRoute } from "@tanstack/react-router";
import { ProfileCard } from "@/components/settings-sections";
import { SettingsPage } from "@/components/settings-page";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  head: () => ({ meta: [
    { title: "Profile Settings — CoursePro" },
    { name: "description", content: "Update your CoursePro profile, username, photo, school, and major." },
    { property: "og:title", content: "Profile Settings — CoursePro" },
    { property: "og:description", content: "Update your CoursePro profile, username, photo, school, and major." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ProfilePage,
});

function ProfilePage() {
  return <SettingsPage title="Profile" description="Manage how your name and school information appear across CoursePro."><ProfileCard /></SettingsPage>;
}