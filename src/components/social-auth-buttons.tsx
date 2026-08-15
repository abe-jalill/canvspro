import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { lovable } from "@/integrations/lovable/index";

const PROVIDERS = [
  { id: "google" as const, label: "Continue with Google" },
  { id: "apple" as const, label: "Continue with Apple" },
];

export function SocialAuthButtons() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: "google" | "apple") {
    setError(null);
    setBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message ?? "Sign-in failed. Please try again.");
        setBusy(null);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    }
    setBusy(null);
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-foreground/15" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-foreground/15" />
      </div>
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={busy !== null}
          onClick={() => signIn(p.id)}
          className="glass-inset glass-hover min-h-12 w-full rounded-xl px-4 text-sm font-medium text-foreground disabled:opacity-60"
        >
          {busy === p.id ? "Connecting…" : p.label}
        </button>
      ))}
      {error && <p className="text-sm text-foreground/80">{error}</p>}
    </div>
  );
}
