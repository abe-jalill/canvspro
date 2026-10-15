import { createFileRoute } from "@tanstack/react-router";
import { ClassSettingsSection } from "@/components/settings-sections";
import { SettingsPage } from "@/components/settings-page";

export const Route = createFileRoute("/_authenticated/settings/classes")({
  head: () => ({ meta: [
    { title: "Class Settings — CoursePro" },
    { name: "description", content: "Rename Canvas classes and choose which classes appear in CoursePro." },
    { property: "og:title", content: "Class Settings — CoursePro" },
    { property: "og:description", content: "Rename Canvas classes and choose which classes appear in CoursePro." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ClassSettingsPage,
});

function ClassSettingsPage() {
  return <SettingsPage title="Class settings" description="Keep class names clear and decide which classes appear throughout CoursePro."><ClassSettingsSection /></SettingsPage>;
}