import { createFileRoute } from "@tanstack/react-router";
import { CanvasConnectionSettings } from "@/components/settings-sections";
import { SettingsPage } from "@/components/settings-page";

export const Route = createFileRoute("/_authenticated/settings/canvas")({
  head: () => ({ meta: [
    { title: "Canvas Connection — CanvasPro" },
    { name: "description", content: "Connect CanvasPro to your school's Canvas account." },
    { property: "og:title", content: "Canvas Connection — CanvasPro" },
    { property: "og:description", content: "Connect CanvasPro to your school's Canvas account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CanvasConnectionPage,
});

function CanvasConnectionPage() {
  return <SettingsPage title="Canvas connection" description="Manage the school address and key CanvasPro uses to load your courses."><CanvasConnectionSettings /></SettingsPage>;
}