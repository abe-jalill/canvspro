import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Camera,
  Check,
  ExternalLink,
  LoaderCircle,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import {
  useCanvasKey,
  useCanvasDomain,
  useSaveCanvasKey,
  useSaveCanvasDomain,
  normalizeCanvasDomain,
} from "@/lib/user-settings";
import { CanvasTokenModal } from "@/components/canvas-token-modal";
import { getCanvasTokenSettingsUrl } from "@/lib/school-domains";
import {
  isUsernameAvailable,
  normalizeUsername,
  removeProfileAvatar,
  saveLocalProfile,
  uploadProfileAvatar,
  usernameValidationMessage,
  useUserProfile,
  useSaveUserProfile,
  type UserProfile,
} from "@/lib/user-profile";
import { ClassNamesSection } from "@/components/class-names-editor";
import { HiddenCoursesSection } from "@/components/hidden-courses-editor";
import { DeleteAccountSection } from "@/components/delete-account";
import { useAnnouncementWindow } from "@/lib/announcement-window";
import { AppearanceSettings } from "@/components/appearance-settings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CanvasPro" },
      {
        name: "description",
        content: "Save the Canvas API key used to load your courses in CanvasPro.",
      },
      { property: "og:title", content: "Settings — CanvasPro" },
      {
        property: "og:description",
        content: "Save the Canvas API key used to load your courses in CanvasPro.",
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
  const hash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  // Pre-fill the Canvas URL once the saved value arrives, unless the user
  // already started typing their own.
  useEffect(() => {
    if (!domainTouched) setDomainValue(savedDomain ?? "");
  }, [savedDomain, domainTouched]);

  const saveDomain = useSaveCanvasDomain();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    // Saving with an empty key field while a key exists would silently wipe
    // the connection — only the explicit "Clear key" button does that.
    if (!value.trim() && (savedKey || isLoading)) {
      if (isLoading) return;
      // Key already saved: allow correcting just the Canvas URL.
      try {
        await saveDomain.mutateAsync(domainValue);
        setStatus("Canvas URL saved and verified with your saved key.");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Could not save.");
      }
      return;
    }
    try {
      await save.mutateAsync({ key: value, domain: domainValue });
      setStatus(value.trim() ? "Canvas connection saved and verified." : "Canvas API key cleared.");
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
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
      <header className="px-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Your account
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Personalize CanvasPro, manage your Canvas connection, and control what the app can do.
        </p>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <a href="#appearance">Appearance</a>
          <a href="#profile">Profile</a>
          <a href="#canvas">Canvas</a>
          <a href="#notifications">Notifications</a>
          <a href="#courses">Courses</a>
          <a href="#account">Account</a>
        </nav>

        <div className="min-w-0 space-y-5">
          <section id="appearance" className="scroll-mt-5">
            <AppearanceSettings />
          </section>
          <section id="profile" className="scroll-mt-5">
            <ProfileCard />
          </section>

          <section id="canvas" className="scroll-mt-5">
            <GlassCard
              title="Canvas connection"
              subtitle="Your school's Canvas URL and API key."
              action={
                <CanvasTokenModal
                  trigger={
                    <button
                      type="button"
                      className="glass-inset glass-hover inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-foreground transition"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span>3-Step Visual Guide</span>
                    </button>
                  }
                />
              }
            >
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
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <p>Generate one in Canvas under Account → Settings → New Access Token.</p>
                  {domainValue.trim() && (
                    <a
                      href={getCanvasTokenSettingsUrl(domainValue)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      <span>Open {normalizeCanvasDomain(domainValue) || "Canvas"} Token Page</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
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
                      domainLoading ? "Loading…" : (savedDomain ?? "yourschool.instructure.com")
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
                  <span className="whitespace-nowrap">yourschool.instructure.com</span>. Each
                  student connects to their own school.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={save.isPending}
                    className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto sm:min-w-24"
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
          </section>

          <section id="notifications" className="scroll-mt-5">
            <GlassCard title="Notifications" subtitle="Choose which alerts you want and when.">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Full controls — due-date lead times, grade thresholds, browser pop-ups, and quiet
                  hours — live on their own page.
                </p>
                <Link
                  to="/notifications"
                  className="glass-hover inline-flex min-h-11 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
                >
                  Open notification settings
                </Link>
              </div>
            </GlassCard>
          </section>

          <section id="courses" className="scroll-mt-5 space-y-5">
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
          </section>

          <section className="scroll-mt-5">
            <GlassCard
              title="Connect an AI assistant"
              subtitle="Let an app like Claude or ChatGPT read your classes for you."
            >
              <AiConnectionSection />
            </GlassCard>
          </section>



          <section id="account" className="scroll-mt-5">
            <GlassCard
              title="Delete account"
              subtitle="Permanently remove your account and everything saved with it."
            >
              <DeleteAccountSection />
            </GlassCard>
          </section>
        </div>
      </div>
    </div>
  );
}

function AiConnectionSection() {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === "undefined" ? "https://canvaspro.app/mcp" : `${window.location.origin}/mcp`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Add this address to your assistant's connectors, sign in once, and approve the request. It
        can then answer questions about your real classes, deadlines, and grades.
      </p>
      <div className="glass-inset flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate text-foreground">{url}</code>
        <button
          type="button"
          onClick={copy}
          className="glass-hover min-h-10 rounded-lg px-3 text-xs font-semibold text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Read-only. An assistant can never change anything in Canvas or see your Canvas API key, and
        you can remove the connection from your assistant at any time.
      </p>
    </div>
  );
}


function AnnouncementWindowSection() {
  const { weeks, isLoading, ready, set } = useAnnouncementWindow();
  const options: Array<{ value: 0 | 1 | 2 | 4; label: string }> = [
    { value: 1, label: "1 week" },
    { value: 2, label: "2 weeks" },
    { value: 4, label: "1 month" },
    { value: 0, label: "All" },
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
        {isLoading ? "Loading…" : "Announcements older than this are hidden from the list."}
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
  username: "",
  avatarPath: "",
  avatarUrl: "",
};

function ProfileCard() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useUserProfile();
  const save = useSaveUserProfile();
  const [form, setForm] = useState<UserProfile>(EMPTY_PROFILE);
  const [dirty, setDirty] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [usernameState, setUsernameState] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const fileInput = useRef<HTMLInputElement>(null);

  // Pre-fill once the saved profile arrives, unless the user already typed.
  useEffect(() => {
    if (profile && !dirty) setForm(profile);
  }, [profile, dirty]);

  useEffect(() => {
    const username = normalizeUsername(form.username);
    if (!username) {
      setUsernameState("idle");
      return;
    }
    if (usernameValidationMessage(username)) {
      setUsernameState("invalid");
      return;
    }

    let active = true;
    setUsernameState("checking");
    const timeout = window.setTimeout(() => {
      void isUsernameAvailable(username)
        .then((available) => {
          if (active) setUsernameState(available ? "available" : "taken");
        })
        .catch(() => {
          if (active) setUsernameState("idle");
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [form.username]);

  function set<K extends keyof UserProfile>(key: K, value: string) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (usernameState === "taken" || usernameState === "invalid") return;
    await save.mutateAsync(form);
    setDirty(false);
  }

  async function onAvatarSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const avatar = await uploadProfileAvatar(file);
      setForm((current) => {
        const next = { ...current, avatarPath: avatar.path, avatarUrl: avatar.url };
        saveLocalProfile(next);
        queryClient.setQueryData(["user-profile"], next);
        return next;
      });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Could not upload that picture.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await removeProfileAvatar(form.avatarPath);
      setForm((current) => {
        const next = { ...current, avatarPath: "", avatarUrl: "" };
        saveLocalProfile(next);
        queryClient.setQueryData(["user-profile"], next);
        return next;
      });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Could not remove the picture.");
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <GlassCard
      title="Profile"
      subtitle="Your photo, username, name, and school — synced securely across your devices."
    >
      <form onSubmit={onSubmit} className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-foreground/15 bg-foreground/[0.06] shadow-glass">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                <UserRound className="h-10 w-10" aria-hidden="true" />
              </span>
            )}
            {avatarBusy && (
              <span className="absolute inset-0 flex items-center justify-center bg-background/65">
                <LoaderCircle className="h-6 w-6 animate-spin" aria-label="Uploading" />
              </span>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={avatarBusy}
                className="glass-inset glass-hover inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                {form.avatarPath ? "Change photo" : "Add photo"}
              </button>
              {form.avatarPath && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={avatarBusy}
                  className="glass-inset glass-hover inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF. Maximum 5 MB.</p>
            {avatarError && <p className="text-xs text-red-400">{avatarError}</p>}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onAvatarSelected}
              className="sr-only"
            />
          </div>
        </div>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Username
          </span>
          <div className="relative">
            <input
              type="text"
              value={form.username}
              onChange={(e) => set("username", e.target.value.toLowerCase())}
              placeholder={isLoading ? "Loading…" : "Choose a unique username"}
              autoComplete="username"
              maxLength={24}
              aria-describedby="username-status"
              className="glass-inset min-h-11 w-full rounded-xl bg-transparent px-4 pr-11 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameState === "checking" && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {usernameState === "available" && <Check className="h-4 w-4 text-emerald-400" />}
              {(usernameState === "taken" || usernameState === "invalid") && (
                <X className="h-4 w-4 text-red-400" />
              )}
            </span>
          </div>
          <p
            id="username-status"
            className={
              usernameState === "taken" || usernameState === "invalid"
                ? "text-xs text-red-400"
                : usernameState === "available"
                  ? "text-xs text-emerald-400"
                  : "text-xs text-muted-foreground"
            }
          >
            {usernameState === "taken"
              ? "That username is already taken."
              : usernameState === "invalid"
                ? usernameValidationMessage(form.username)
                : usernameState === "available"
                  ? "Username is available. You can use it to sign in."
                  : "3–24 characters: lowercase letters, numbers, and underscores."}
          </p>
        </label>

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
            disabled={
              save.isPending ||
              usernameState === "checking" ||
              usernameState === "taken" ||
              usernameState === "invalid" ||
              (!dirty && isLoading)
            }
            className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto sm:min-w-32"
          >
            {save.isPending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
