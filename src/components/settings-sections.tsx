import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Camera,
  Check,
  ExternalLink,
  LoaderCircle,
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
import { supabase } from "@/integrations/supabase/client";
import { detectCanvasDomainFromEmail, getCanvasTokenSettingsUrl } from "@/lib/school-domains";
import {
  isUsernameAvailable,
  normalizeUsername,
  removeProfileAvatar,
  saveLocalProfile,
  uploadProfileAvatar,
  usernameValidationMessage,
  useUserProfile,
  useSaveUserProfile,
  NICKNAME_MAX_LENGTH,
  type UserProfile,
} from "@/lib/user-profile";
import { ClassNamesSection } from "@/components/class-names-editor";
import { HiddenCoursesSection } from "@/components/hidden-courses-editor";
import { useAnnouncementWindow } from "@/lib/announcement-window";

function SetupStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="pt-0.5 text-sm font-medium text-foreground">{title}</p>
        {children}
      </div>
    </li>
  );
}

export function CanvasConnectionSettings() {
  const navigate = useNavigate();
  const { data: savedKey, isLoading } = useCanvasKey();
  const { data: savedDomain, isLoading: domainLoading } = useCanvasDomain();
  const save = useSaveCanvasKey();
  const [value, setValue] = useState("");
  const [domainValue, setDomainValue] = useState("");
  const [domainTouched, setDomainTouched] = useState(false);
  const [emailGuess, setEmailGuess] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Most students sign up with their school email, so guess the Canvas URL
  // from it and spare them looking it up.
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmailGuess(detectCanvasDomainFromEmail(data.user?.email)?.canvasDomain ?? null);
    });
  }, []);

  // Pre-fill the Canvas URL once the saved value (or the email guess) arrives,
  // unless the user already started typing their own.
  useEffect(() => {
    if (!domainTouched && !domainLoading) setDomainValue(savedDomain ?? emailGuess ?? "");
  }, [savedDomain, emailGuess, domainLoading, domainTouched]);

  const saveDomain = useSaveCanvasDomain();
  const cleanDomain = normalizeCanvasDomain(domainValue);
  const guessedFromEmail = !savedDomain && !!emailGuess && domainValue === emailGuess;

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
    if (!value.trim()) {
      setStatus("Paste your Canvas API key in step 3 first.");
      return;
    }
    const firstConnection = !savedKey;
    try {
      await save.mutateAsync({ key: value, domain: domainValue });
      setValue("");
      setStatus("Canvas connection saved and verified.");
      // First-time setup is done — take them straight to their classes.
      if (firstConnection) void navigate({ to: "/dashboard" });
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

  const inputClass =
    "glass-inset min-h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20";

  return (
    <GlassCard
      title="Canvas connection"
      subtitle={
        savedKey
          ? "Connected. Paste a new key below any time you need to replace it."
          : "Connect in 3 steps. It takes about a minute."
      }
    >
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-6">
        {!isLoading && (
          <p
            className={
              savedKey
                ? "inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500"
                : "inline-flex w-fit items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 text-xs font-medium text-muted-foreground"
            }
          >
            {savedKey && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            {savedKey
              ? `Connected${savedDomain ? ` · ${savedDomain}` : ""}`
              : "Not connected yet"}
          </p>
        )}

        <ol className="flex flex-col gap-6">
          <SetupStep n={1} title="Check your school's Canvas address">
            <input
              type="text"
              aria-label="Canvas URL"
              value={domainValue}
              onChange={(e) => {
                setDomainTouched(true);
                setDomainValue(e.target.value);
              }}
              placeholder={domainLoading ? "Loading…" : "yourschool.instructure.com"}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              {guessedFromEmail
                ? "We filled this in from your email. Change it if it's not the address you use to open Canvas."
                : "The address you type to open Canvas, like yourschool.instructure.com."}
            </p>
          </SetupStep>

          <SetupStep n={2} title="Create a key in Canvas">
            <a
              href={getCanvasTokenSettingsUrl(cleanDomain || null)}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!cleanDomain}
              onClick={(e) => {
                if (!cleanDomain) {
                  e.preventDefault();
                  setStatus("Enter your school's Canvas address in step 1 first.");
                }
              }}
              className="glass-inset glass-hover inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-foreground aria-disabled:opacity-50 sm:w-auto"
            >
              <span>Open Canvas</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </a>
            <p className="text-xs leading-5 text-muted-foreground">
              On that page, click <strong className="text-foreground">+ New Access Token</strong>,
              type <strong className="text-foreground">CoursePro</strong> as the purpose, click{" "}
              <strong className="text-foreground">Generate Token</strong>, then copy the key it
              shows you.
            </p>
          </SetupStep>

          <SetupStep n={3} title="Paste the key here">
            <input
              type="password"
              aria-label="Canvas API key"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                isLoading
                  ? "Loading…"
                  : savedKey
                    ? "A key is saved — paste a new one to replace it"
                    : "Paste your Canvas key"
              }
              autoComplete="off"
              className={inputClass}
            />
          </SetupStep>
        </ol>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={save.isPending || saveDomain.isPending}
            className="glass-hover inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto"
          >
            {(save.isPending || saveDomain.isPending) && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            <span>
              {save.isPending || saveDomain.isPending
                ? "Checking with Canvas…"
                : savedKey
                  ? "Save"
                  : "Connect"}
            </span>
          </button>
          {savedKey && (
            <button
              type="button"
              onClick={onClear}
              disabled={save.isPending}
              className="glass-hover glass-inset min-h-12 w-full rounded-xl px-4 text-sm font-medium disabled:opacity-50 sm:w-auto"
            >
              Clear key
            </button>
          )}
        </div>
        {status && (
          <p role="status" className="text-sm text-muted-foreground">
            {status}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Your key only lets CoursePro read what your student account can already see. You can
          delete it any time in Canvas under Settings → Approved Integrations.
        </p>
      </form>
    </GlassCard>
  );
}

export function AiConnectionSection() {
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

export function ClassSettingsSection() {
  const [tab, setTab] = useState<"names" | "visibility">("names");

  return (
    <GlassCard title="Class settings" subtitle="Rename classes and choose which ones appear.">
      <div>
          <div className="glass-inset mb-5 grid grid-cols-2 gap-1 rounded-xl p-1" role="tablist" aria-label="Class settings">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "names"}
              aria-controls="class-names-panel"
              onClick={() => setTab("names")}
              className={
                tab === "names"
                  ? "min-h-10 rounded-lg bg-foreground px-3 text-sm font-semibold text-background"
                  : "glass-hover min-h-10 rounded-lg px-3 text-sm font-medium text-muted-foreground"
              }
            >
              Class names
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "visibility"}
              aria-controls="classes-shown-panel"
              onClick={() => setTab("visibility")}
              className={
                tab === "visibility"
                  ? "min-h-10 rounded-lg bg-foreground px-3 text-sm font-semibold text-background"
                  : "glass-hover min-h-10 rounded-lg px-3 text-sm font-medium text-muted-foreground"
              }
            >
              Classes shown
            </button>
          </div>

          <div
            id={tab === "names" ? "class-names-panel" : "classes-shown-panel"}
            role="tabpanel"
          >
            {tab === "names" ? <ClassNamesSection /> : <HiddenCoursesSection />}
          </div>
      </div>
    </GlassCard>
  );
}


export function AnnouncementWindowSection() {
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

export function ProfileCard() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isFetchedAfterMount, isError } = useUserProfile();
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
    try {
      await save.mutateAsync(form);
      setDirty(false);
    } catch { /* The mutation displays the error and keeps the draft. */ }
  }

  async function onAvatarSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await queryClient.cancelQueries({ queryKey: ["user-profile"] });
      const avatar = await uploadProfileAvatar(file);
      await queryClient.cancelQueries({ queryKey: ["user-profile"] });
      setForm((current) => ({ ...current, avatarPath: avatar.path, avatarUrl: avatar.url }));
      // Publishing a photo must not publish unsaved text from this form.
      queryClient.setQueryData<UserProfile>(["user-profile"], (saved) => {
        if (!saved) return saved;
        const next = { ...saved, avatarPath: avatar.path, avatarUrl: avatar.url };
        saveLocalProfile(next);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
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
      await queryClient.cancelQueries({ queryKey: ["user-profile"] });
      await removeProfileAvatar(form.avatarPath);
      await queryClient.cancelQueries({ queryKey: ["user-profile"] });
      setForm((current) => ({ ...current, avatarPath: "", avatarUrl: "" }));
      // Publishing a photo must not publish unsaved text from this form.
      queryClient.setQueryData<UserProfile>(["user-profile"], (saved) => {
        if (!saved) return saved;
        const next = { ...saved, avatarPath: "", avatarUrl: "" };
        saveLocalProfile(next);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
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
      <form onSubmit={onSubmit}>
        {isError && <p role="alert" className="mb-3 text-sm text-red-500">Could not load your profile. Reconnect and try again.</p>}
        <fieldset disabled={save.isPending || avatarBusy || !isFetchedAfterMount || isError} className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
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
            ["nickname", "Nickname", `What you'd like to be called (up to ${NICKNAME_MAX_LENGTH} letters)`],
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
              maxLength={key === "nickname" ? NICKNAME_MAX_LENGTH : undefined}
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
        </fieldset>
      </form>
    </GlassCard>
  );
}
