import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { GraduationCap, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSaveUserProfile, useUserProfile, type UserProfile } from "@/lib/user-profile";
import { supabase } from "@/integrations/supabase/client";
import { useScopedKey } from "@/lib/user-scope";

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

const inputClass =
  "glass-inset min-h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/55 focus:ring-1 focus:ring-foreground/25";

export function ProfileCompletionDialog({ user }: { user: User }) {
  const profile = useUserProfile();
  const save = useSaveUserProfile();
  const seenKey = useScopedKey("profile-completion-prompt-v1");
  const [form, setForm] = useState<UserProfile>(EMPTY_PROFILE);
  const [edited, setEdited] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(seenKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (profile.data && !edited) setForm(profile.data);
  }, [edited, profile.data]);

  const metadataHandled = Boolean(
    user.user_metadata?.profile_setup_prompted || user.user_metadata?.profile_setup_completed,
  );
  const missingRequired = !profile.data?.firstName.trim() || !profile.data?.lastName.trim();
  const open = profile.isFetchedAfterMount && missingRequired && !metadataHandled && !dismissed;

  function update(key: keyof UserProfile, value: string) {
    setEdited(true);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function markHandled(syncMetadata = true) {
    try {
      localStorage.setItem(seenKey, "1");
    } catch {
      // A private browsing session can reject local storage writes.
    }
    setDismissed(true);
    if (syncMetadata) {
      const { error } = await supabase.auth.updateUser({
        data: { profile_setup_prompted: true },
      });
      if (error) console.warn("Could not sync profile prompt state:", error);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    await save.mutateAsync(form);
    await markHandled(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) void markHandled();
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-xl overflow-y-auto rounded-[2rem] border-foreground/10 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl">
        <div className="border-b border-foreground/10 bg-foreground/[0.035] px-6 pb-5 pt-7 sm:px-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.06]">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogHeader>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              One last detail
            </p>
            <DialogTitle className="mt-1 text-2xl font-medium tracking-[-0.035em] sm:text-3xl">
              Make CanvasPro yours.
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-md leading-relaxed">
              Add your name so greetings and your workspace feel personal. Academic details are
              optional.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField
              label="First name"
              value={form.firstName}
              onChange={(value) => update("firstName", value)}
              autoComplete="given-name"
              placeholder="First name"
              required
            />
            <ProfileField
              label="Last name"
              value={form.lastName}
              onChange={(value) => update("lastName", value)}
              autoComplete="family-name"
              placeholder="Last name"
              required
            />
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              <span>Academic details · optional</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileField
                label="Major"
                value={form.major}
                onChange={(value) => update("major", value)}
                placeholder="e.g. Computer Science"
              />
              <ProfileField
                label="Class of"
                value={form.classOf}
                onChange={(value) => update("classOf", value)}
                placeholder="e.g. 2028"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void markHandled()}
              className="min-h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Not now
            </button>
            <button
              type="submit"
              disabled={save.isPending || !form.firstName.trim() || !form.lastName.trim()}
              className="press min-h-11 rounded-xl bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Complete profile"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={inputClass}
      />
    </label>
  );
}
