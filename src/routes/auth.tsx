import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field } from "@/components/auth-ui";
import { SocialAuthButtons } from "@/components/social-auth-buttons";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Canvas Pro" },
      {
        name: "description",
        content: "Sign in to Canvas Pro to see your classes, grades, and assignments.",
      },
      { property: "og:title", content: "Sign in — Canvas Pro" },
      {
        property: "og:description",
        content: "Sign in to Canvas Pro to see your classes, grades, and assignments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate({ to: "/", replace: true });
  }

  return (
    <AuthShell
      title="Sign in to Canvas Pro"
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
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@school.edu"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="••••••••"
        />
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
