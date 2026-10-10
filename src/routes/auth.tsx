import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field } from "@/components/auth-ui";
import { signInWithUsername } from "@/lib/username-auth.functions";
import { LegalConsent } from "@/components/legal-consent";
import { createLegalConsentMetadata } from "@/lib/legal-consent";
import { Capacitor } from "@capacitor/core";
import { requestMobileApi } from "@/lib/mobile-api-client";
import { safeReturnPath } from "@/lib/outbound-policy";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — CanvasPro" },
      {
        name: "description",
        content: "Sign in to CanvasPro to see your classes, grades, and assignments.",
      },
      { property: "og:title", content: "Sign in — CanvasPro" },
      {
        property: "og:description",
        content: "Sign in to CanvasPro to see your classes, grades, and assignments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

/** Only same-origin app paths may be returned to (e.g. the OAuth consent page). */
function returnPath(): string | null {
  if (typeof window === "undefined") return null;
  return safeReturnPath(
    new URLSearchParams(window.location.search).get("redirect"),
    window.location.origin,
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      const back = returnPath();
      if (back) window.location.replace(back);
      else navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);


  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let consent;
    try {
      consent = createLegalConsentMetadata(legalAccepted);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please accept the policies.");
      return;
    }
    setBusy(true);
    try {
      const cleanIdentifier = identifier.trim();
      let signInError: Error | null = null;
      if (cleanIdentifier.includes("@")) {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanIdentifier,
          password,
        });
        signInError = error;
      } else {
        try {
          const credentials = { username: cleanIdentifier, password };
          const session = Capacitor.isNativePlatform()
            ? await requestMobileApi<{ access_token: string; refresh_token: string }>("sign-in", credentials)
                .then((data) => ({ accessToken: data.access_token, refreshToken: data.refresh_token }))
            : await signInWithUsername({ data: credentials });
          const { error } = await supabase.auth.setSession({
            access_token: session.accessToken,
            refresh_token: session.refreshToken,
          });
          signInError = error;
        } catch (usernameError) {
          signInError =
            usernameError instanceof Error ? usernameError : new Error("Sign-in failed.");
        }
      }
      if (signInError) {
        setError(signInError.message);
        return;
      }
      const { error: consentError } = await supabase.auth.updateUser({ data: consent });
      if (consentError) {
        await supabase.auth.signOut({ scope: "local" });
        setError("We couldn't save your agreement. Please sign in again.");
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      await supabase.auth.signOut({ scope: "local" });
      setError(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in to CanvasPro"
      subtitle="Access your classes, grades, and assignments"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium text-foreground underline underline-offset-4">
            Sign up
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
        <Field
          label="Email or username"
          type="text"
          value={identifier}
          onChange={setIdentifier}
          autoComplete="username"
          placeholder="you@school.edu or username"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="••••••••"
        />
        <p className="-mt-2 text-right text-xs">
          <Link
            to="/forgot-password"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Forgot password?
          </Link>
        </p>
        <LegalConsent checked={legalAccepted} onChange={setLegalAccepted} />
        {error && (
          <p role="alert" className="text-sm text-foreground/80">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="glass-hover min-h-12 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
