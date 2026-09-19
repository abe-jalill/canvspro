import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { GlassCard } from "@/components/glass-card";
import { Check, Copy, CalendarSync } from "lucide-react";

const FEED_TOKEN_KEY = "ics-feed-token";

/**
 * Live "subscribe" calendar feed for the user's CanvasPro deadlines.
 * Google Calendar (Other calendars → From URL), Apple Calendar and Outlook
 * can all subscribe, so new due dates appear without re-exporting.
 */
export function CalendarSubscribeCard() {
  const { value, set, isLoading } = useUserPreferenceKey<{ token?: string }>(
    FEED_TOKEN_KEY,
    {},
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Provision a private feed token once, scoped to this account.
    if (!isLoading && !value?.token) {
      set({ token: crypto.randomUUID() });
    }
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, value?.token]);

  const feedUrl = useMemo(() => {
    if (!userId || !value?.token) return null;
    return `${window.location.origin}/api/public/calendar/${userId}/${value.token}`;
  }, [userId, value?.token]);

  async function copy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the input still allows manual selection
    }
  }

  return (
    <GlassCard
      title="Calendar sync"
      subtitle="Deadlines auto-update in Google Calendar, Apple Calendar, or Outlook."
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
          <CalendarSync className="h-4 w-4 text-foreground/80" />
        </div>
        <ol className="list-decimal space-y-1 pl-1 text-sm text-muted-foreground">
          <li>Copy your private CanvasPro calendar link below.</li>
          <li>
            In Google Calendar: <span className="text-foreground/85">Other calendars → From URL</span>, then paste it.
          </li>
          <li>
            New due dates appear automatically — no re-exporting, ever.
          </li>
        </ol>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          readOnly
          value={feedUrl ?? ""}
          placeholder={feedUrl ? undefined : "Preparing your link…"}
          aria-label="Calendar feed link"
          className="glass-inset min-h-11 w-full rounded-xl bg-transparent px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <button
          type="button"
          onClick={copy}
          disabled={!feedUrl}
          className="glass-hover inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-3 text-sm font-semibold text-background disabled:opacity-60"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Anyone with this link can see your due dates — don't share it.
      </p>
    </GlassCard>
  );
}
