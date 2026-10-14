import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId, userKey } from "@/lib/auth-user";
import { createLegalConsentMetadata, LEGAL_POLICY_VERSION } from "@/lib/legal-consent";

/**
 * Accounts that accepted an older Terms of Use and Privacy Policy see this
 * until they accept the current version. Sign-in already records acceptance;
 * this reaches people who stay signed in. Until they accept, the version they
 * last accepted keeps applying (Terms §14).
 */
export function PolicyUpdateBanner() {
  const { userId } = useAuthUserId();
  const queryClient = useQueryClient();
  const queryKey = userKey(["accepted-legal-version"], userId);
  const accepted = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const version = data.user?.user_metadata?.terms_accepted_version;
      return typeof version === "string" ? version : null;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userId || !accepted.isSuccess || accepted.data === LEGAL_POLICY_VERSION) return null;

  async function agree() {
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase.auth.updateUser({
      data: createLegalConsentMetadata(true),
    });
    setBusy(false);
    if (saveError) {
      setError("Could not save that. Please try again.");
      return;
    }
    queryClient.setQueryData(queryKey, LEGAL_POLICY_VERSION);
  }

  return (
    <div className="glass-panel-strong mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 text-sm text-muted-foreground">
          <p>
            We updated our{" "}
            <Link to="/terms" className="text-foreground underline underline-offset-4">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-foreground underline underline-offset-4">
              Privacy Policy
            </Link>
            . CanvasPro is becoming a paid subscription with a free trial, sold through Paddle; the
            Terms now cover billing, renewals, cancellation and refunds, and still use individual
            arbitration, which you can opt out of within 30 days of agreeing.
          </p>
          {error && <p className="mt-1 text-destructive">{error}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={agree}
        disabled={busy}
        className="glass-hover inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
      >
        {busy ? "Saving…" : "I agree"}
      </button>
    </div>
  );
}
