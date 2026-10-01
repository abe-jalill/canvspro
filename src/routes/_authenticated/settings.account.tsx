import { createFileRoute } from "@tanstack/react-router";
import { DeleteAccountSection } from "@/components/delete-account";
import { GlassCard } from "@/components/glass-card";
import { SettingsPage } from "@/components/settings-page";

export const Route = createFileRoute("/_authenticated/settings/account")({
  head: () => ({ meta: [
    { title: "Account Settings — CanvasPro" },
    { name: "description", content: "Manage permanent account deletion in CanvasPro." },
    { property: "og:title", content: "Account Settings — CanvasPro" },
    { property: "og:description", content: "Manage permanent account deletion in CanvasPro." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  return <SettingsPage title="Account" description="Manage permanent account actions."><GlassCard title="Delete account" subtitle="Permanently remove your account and everything saved with it."><DeleteAccountSection /></GlassCard></SettingsPage>;
}