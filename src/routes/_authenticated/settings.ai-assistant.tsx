import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/glass-card";
import { AiConnectionSection } from "@/components/settings-sections";
import { SettingsPage } from "@/components/settings-page";

export const Route = createFileRoute("/_authenticated/settings/ai-assistant")({
  head: () => ({ meta: [
    { title: "AI Assistant Connection — CanvasPro" },
    { name: "description", content: "Connect an AI assistant to your CanvasPro classes and deadlines." },
    { property: "og:title", content: "AI Assistant Connection — CanvasPro" },
    { property: "og:description", content: "Connect an AI assistant to your CanvasPro classes and deadlines." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AiAssistantPage,
});

function AiAssistantPage() {
  return <SettingsPage title="AI assistant" description="Connect an assistant securely with read-only access to your CanvasPro information."><GlassCard title="Connect an AI assistant" subtitle="Let an app like Claude or ChatGPT read your classes for you."><AiConnectionSection /></GlassCard></SettingsPage>;
}