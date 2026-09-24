import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field } from "@/components/auth-ui";
import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { signInWithUsername } from "@/lib/username-auth.functions";

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

function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
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
        const session = await signInWithUsername({
          data: { username: cleanIdentifier, password },
        });
        const { error } = await supabase.auth.setSession({
          access_token: session.accessToken,
          refresh_token: session.refreshToken,
        });
        signInError = error;
      } catch (usernameError) {
        signInError = usernameError instanceof Error ? usernameError : new Error("Sign-in failed.");
      }
    }
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
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
        {error && <p className="text-sm text-foreground/80">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="glass-hover min-h-12 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        By signing in, you agree to our{" "}
        <Link to="/terms" className="font-medium text-foreground underline underline-offset-4">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="font-medium text-foreground underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-5">
        <SocialAuthButtons />
      </div>
    </AuthShell>
  );
}
