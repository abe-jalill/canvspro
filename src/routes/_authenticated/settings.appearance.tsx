import { createFileRoute } from "@tanstack/react-router";
import { AppearanceSettings } from "@/components/appearance-settings";
import { SettingsPage } from "@/components/settings-page";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  head: () => ({ meta: [
    { title: "Appearance Settings — CanvasPro" },
    { name: "description", content: "Choose CanvasPro colors and light or dark appearance." },
    { property: "og:title", content: "Appearance Settings — CanvasPro" },
    { property: "og:description", content: "Choose CanvasPro colors and light or dark appearance." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AppearancePage,
});

function AppearancePage() {
  return <SettingsPage title="Appearance" description="Choose the colors and appearance that feel right to you."><AppearanceSettings /></SettingsPage>;
}