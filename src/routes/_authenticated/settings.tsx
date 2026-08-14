import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { GlassCard } from "@/components/glass-card";
import { useCanvasKey, useSaveCanvasKey } from "@/lib/user-settings";
import { ClassNamesSection } from "@/components/class-names-editor";
import { NotificationSettings } from "@/components/notification-settings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Canvas Pro" },
      {
        name: "description",
        content: "Save the Canvas API key used to load your courses in Canvas Pro.",
      },
      { property: "og:title", content: "Settings — Canvas Pro" },
      {
        property: "og:description",
        content: "Save the Canvas API key used to load your courses in Canvas Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: savedKey, isLoading } = useCanvasKey();
  const save = useSaveCanvasKey();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);


  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      await save.mutateAsync(value);
      setStatus(value.trim() ? "Canvas API key saved." : "Canvas API key cleared.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save the key.");
    }
  }

  async function onClear() {
    setStatus(null);
    setValue("");
    try {
      await save.mutateAsync(null);
      setStatus("Canvas API key cleared.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not clear the key.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Canvas API key is stored securely on your account.
        </p>
      </header>

      <GlassCard title="Canvas API key" subtitle="Used to load your courses, grades, and assignments.">
        <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
          <label className="flex w-full flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              API key
            </span>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isLoading ? "Loading…" : "Paste your Canvas access token"}
              autoComplete="off"
              className="glass-inset min-h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Generate one in Canvas under Account → Settings → New Access Token.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={save.isPending}
              className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto"
            >
              {save.isPending ? "Saving…" : "Save key"}
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={save.isPending || (!savedKey && !value)}
              className="glass-hover glass-inset min-h-11 w-full rounded-xl px-4 text-sm font-medium disabled:opacity-50 sm:w-auto"
            >
              Clear key
            </button>
          </div>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
          {!isLoading && (
            <p className="text-xs text-muted-foreground">
              Status: {savedKey ? "Key saved" : "No key saved yet"}
            </p>
          )}
        </form>
      </GlassCard>

      <GlassCard
        title="Notifications"
        subtitle="Choose which alerts you want and when."
      >
        <NotificationSettings />
      </GlassCard>

      <GlassCard
        title="Class names"
        subtitle="Rename your Canvas courses to something friendlier."
      >
        <ClassNamesSection />
      </GlassCard>
    </div>
  );
}
