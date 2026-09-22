import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { GlassCard } from "@/components/glass-card";
import { useCanvasKey, useCanvasDomain, useSaveCanvasKey } from "@/lib/user-settings";
import {
  useUserProfile,
  useSaveUserProfile,
  type UserProfile,
} from "@/lib/user-profile";
import { ClassNamesSection } from "@/components/class-names-editor";
import { HiddenCoursesSection } from "@/components/hidden-courses-editor";
import { DeleteAccountSection } from "@/components/delete-account";
import { useAnnouncementWindow } from "@/lib/announcement-window";

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
  const { data: savedDomain, isLoading: domainLoading } = useCanvasDomain();
  const save = useSaveCanvasKey();
  const [value, setValue] = useState("");
  const [domainValue, setDomainValue] = useState("");
  const [domainTouched, setDomainTouched] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Pre-fill the Canvas URL once the saved value arrives, unless the user
  // already started typing their own.
  useEffect(() => {
    if (!domainTouched) setDomainValue(savedDomain ?? "");
  }, [savedDomain, domainTouched]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    // Saving with an empty key field while a key exists would silently wipe
    // the connection — only the explicit "Clear key" button does that.
    if (!value.trim() && (savedKey || isLoading)) {
      setStatus("Paste a new key to replace the saved one, or use Clear key to disconnect.");
      return;
    }
    try {
      await save.mutateAsync({ key: value, domain: domainValue });
      setStatus(
        value.trim()
          ? "Canvas connection saved and verified."
          : "Canvas API key cleared.",
      );
      if (value.trim()) setValue("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save.");
    }
  }

  async function onClear() {
    setStatus(null);
    setValue("");
    setDomainValue("");
    setDomainTouched(true);
    try {
      await save.mutateAsync({ key: null, domain: "" });
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

      <ProfileCard />

      <GlassCard title="Canvas connection" subtitle="Your school's Canvas URL and API key.">
        <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
          <label className="flex w-full flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              API key
            </span>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                isLoading
                  ? "Loading…"
                  : savedKey
                    ? "A key is saved — paste a new one to replace it"
                    : "Paste your Canvas access token"
              }

              autoComplete="off"
              className="glass-inset min-h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Generate one in Canvas under Account → Settings → New Access Token.
          </p>
          <label className="flex w-full flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Canvas URL
            </span>
            <input
              type="text"
              value={domainValue}
              onChange={(e) => {
                setDomainTouched(true);
                setDomainValue(e.target.value);
              }}
              placeholder={
                domainLoading
                  ? "Loading…"
                  : savedDomain ?? "yourschool.instructure.com"
              }
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              className="glass-inset min-h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Your school's Canvas web address — what you type to open Canvas, e.g.{" "}
            <span className="whitespace-nowrap">yourschool.instructure.com</span>. Each student
            connects to their own school.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={save.isPending}
              className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto"
            >
              {save.isPending ? "Saving…" : "Save"}
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
              Status:{" "}
              {savedKey
                ? `Key saved${savedDomain ? ` · ${savedDomain}` : ""}`
                : "No key saved yet"}
            </p>
          )}
        </form>
      </GlassCard>

      <GlassCard
        title="Notifications"
        subtitle="Choose which alerts you want and when."
      >
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Full controls — due-date lead times, grade thresholds, browser
              pop-ups, and quiet hours — live on their own page.
            </p>
            <Link
              to="/notifications"
              className="glass-hover inline-flex min-h-11 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
            >
              Open notification settings
            </Link>
          </div>
        ) : (
          <UpgradeCard feature="Notifications" />
        )}
      </GlassCard>

      <GlassCard
        title="Announcements"
        subtitle="How far back the announcements list reaches."
      >
        <AnnouncementWindowSection />
      </GlassCard>

      <GlassCard
        title="Class names"
        subtitle="Rename your Canvas courses to something friendlier."
      >
        <ClassNamesSection />
      </GlassCard>

      <GlassCard
        title="Which classes to show"
        subtitle="Hide classes you don't want anywhere in the app."
      >
        <HiddenCoursesSection />
      </GlassCard>

      <GlassCard
        title="Delete account"
        subtitle="Permanently remove your account and everything saved with it."
      >
        <DeleteAccountSection />
      </GlassCard>
    </div>
  );
}

function AnnouncementWindowSection() {
  const { weeks, isLoading, ready, set } = useAnnouncementWindow();
  const options: Array<{ value: 1 | 2; label: string }> = [
    { value: 1, label: "1 week" },
    { value: 2, label: "2 weeks" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => set(o.value)}
            disabled={!ready}
            aria-pressed={weeks === o.value}
            className={
              weeks === o.value
                ? "glass-hover min-h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
                : "glass-hover glass-inset min-h-11 rounded-xl px-4 text-sm font-medium disabled:opacity-50"
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {isLoading
          ? "Loading…"
          : "Announcements older than this are hidden from the list."}
      </p>
    </div>
  );
}

const EMPTY_PROFILE: UserProfile = {
  firstName: "",
  lastName: "",
  nickname: "",
  school: "",
  major: "",
  classOf: "",
};

function ProfileCard() {
  const { data: profile, isLoading } = useUserProfile();
  const save = useSaveUserProfile();
  const [form, setForm] = useState<UserProfile>(EMPTY_PROFILE);
  const [dirty, setDirty] = useState(false);

  // Pre-fill once the saved profile arrives, unless the user already typed.
  useEffect(() => {
    if (profile && !dirty) setForm(profile);
  }, [profile, dirty]);

  function set<K extends keyof UserProfile>(key: K, value: string) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await save.mutateAsync(form);
  }

  return (
    <GlassCard
      title="Profile"
      subtitle="Your name and school — saved to your account and used to greet you."
    >
      <form onSubmit={onSubmit} className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {(
          [
            ["firstName", "First name", "Your first name"],
            ["lastName", "Last name", "Your last name"],
            ["nickname", "Nickname", "What you'd like to be called"],
            ["school", "School", "e.g. Lawrence Technological University"],
            ["major", "Major", "e.g. Biomedical Engineering"],
            ["classOf", "Class of", "e.g. 2028"],
          ] as [keyof UserProfile, string, string][]
        ).map(([key, label, placeholder]) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <input
              type="text"
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder={isLoading ? "Loading…" : placeholder}
              autoComplete="off"
              className="glass-inset min-h-11 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20"
            />
          </label>
        ))}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={save.isPending || (!dirty && isLoading)}
            className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto"
          >
            {save.isPending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
