import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Bot,
  ChevronRight,
  GraduationCap,
  Link2,
  Megaphone,
  Palette,
  Trash2,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [
      { title: "Settings — CanvasPro" },
      {
        name: "description",
        content: "Manage your CanvasPro account, classes, alerts, appearance, and connections.",
      },
      { property: "og:title", content: "Settings — CanvasPro" },
      {
        property: "og:description",
        content: "Manage your CanvasPro account, classes, alerts, appearance, and connections.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsOverview,
});

const sections = [
  {
    title: "Appearance",
    description: "Colors and light or dark mode.",
    to: "/settings/appearance" as const,
    icon: Palette,
  },
  {
    title: "Profile",
    description: "Photo, username, name, school, and major.",
    to: "/settings/profile" as const,
    icon: UserRound,
  },
  {
    title: "Canvas connection",
    description: "School URL and Canvas API key.",
    to: "/settings/canvas" as const,
    icon: Link2,
  },
  {
    title: "Notifications",
    description: "Alerts, reminders, quiet hours, and delivery.",
    to: "/settings/notifications" as const,
    icon: Bell,
  },
  {
    title: "Announcements",
    description: "Choose how far back announcements appear.",
    to: "/settings/announcements" as const,
    icon: Megaphone,
  },
  {
    title: "Class settings",
    description: "Rename classes and choose which ones appear.",
    to: "/settings/classes" as const,
    icon: GraduationCap,
  },
  {
    title: "AI assistant",
    description: "Connect Claude, ChatGPT, or another assistant.",
    to: "/settings/ai-assistant" as const,
    icon: Bot,
  },
  {
    title: "Account",
    description: "Permanently delete your account and saved data.",
    to: "/settings/account" as const,
    icon: Trash2,
  },
];

function SettingsOverview() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-10">
      <header className="premium-reveal px-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Your account
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Choose a section to view or change its details.
        </p>
      </header>

      <nav className="grid gap-3 sm:grid-cols-2" aria-label="Settings sections">
        {sections.map(({ title, description, to, icon: Icon }, index) => (
          <Link
            key={to}
            to={to}
            preload="intent"
            className="glass-panel glass-hover premium-card premium-press group flex min-h-24 items-center gap-4 p-4 text-left sm:p-5"
            style={{ animationDelay: `${Math.min(index, 5) * 45 + 45}ms` }}
          >
            <span className="glass-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground">
              <Icon className="premium-icon h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-foreground">{title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {description}
              </span>
            </span>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        ))}
      </nav>
    </div>
  );
}
