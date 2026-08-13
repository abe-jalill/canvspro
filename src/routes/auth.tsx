import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      title="Welcome back"
      subtitle="Sign in to Canvas Pro"
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
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      <div className="glass-panel-strong w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Canvas Pro
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="glass-inset min-h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20"
      />
    </label>
  );
}
