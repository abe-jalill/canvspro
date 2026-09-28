import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field } from "@/components/auth-ui";
import { LegalConsent } from "@/components/legal-consent";
import { createLegalConsentMetadata } from "@/lib/legal-consent";
import { createAgeConfirmationMetadata, MINIMUM_ACCOUNT_AGE } from "@/lib/signup-age";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create account — CanvasPro" },
      {
        name: "description",
        content: "Create a CanvasPro account to track your classes, grades, and assignments.",
      },
      { property: "og:title", content: "Create account — CanvasPro" },
      {
        property: "og:description",
        content: "Create a CanvasPro account to track your classes, grades, and assignments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [major, setMajor] = useState("");
  const [classOf, setClassOf] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    if (!cleanFirstName || !cleanLastName) {
      setError("Enter your first and last name.");
      return;
    }

    let ageMetadata;
    let consent;
    try {
      ageMetadata = createAgeConfirmationMetadata(ageConfirmed);
      consent = createLegalConsentMetadata(legalAccepted);
    } catch (ageError) {
      setError(ageError instanceof Error ? ageError.message : "Confirm your age to continue.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/email-verified`,
        data: {
          first_name: cleanFirstName,
          last_name: cleanLastName,
          full_name: `${cleanFirstName} ${cleanLastName}`,
          major: major.trim(),
          class_of: classOf.trim(),
          profile_setup_prompted: true,
          profile_setup_completed: true,
          ...ageMetadata,
          ...consent,
        },
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    setNotice("Check your email to confirm your account, then sign in.");
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Tell us a little about you. You can change this anytime."
      className="max-w-xl"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            type="text"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
            placeholder="First name"
          />
          <Field
            label="Last name"
            type="text"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
            placeholder="Last name"
          />
        </div>
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
          autoComplete="new-password"
          placeholder="At least 6 characters"
          minLength={6}
        />
        <div className="border-t border-foreground/10 pt-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Academic details
            </p>
            <span className="text-[11px] text-muted-foreground/70">Optional</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Major"
              type="text"
              value={major}
              onChange={setMajor}
              autoComplete="organization-title"
              placeholder="e.g. Computer Science"
              required={false}
            />
            <Field
              label="Class of"
              type="text"
              value={classOf}
              onChange={setClassOf}
              placeholder="e.g. 2028"
              required={false}
            />
          </div>
        </div>
        <label className="glass-inset flex cursor-pointer items-start gap-3 rounded-xl p-4 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={ageConfirmed}
            required
            onChange={(event) => setAgeConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
          />
          <span>I confirm that I am at least {MINIMUM_ACCOUNT_AGE} years old.</span>
        </label>
        <LegalConsent checked={legalAccepted} onChange={setLegalAccepted} />
        {error && (
          <p role="alert" className="text-sm text-foreground/80">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        <button
          type="submit"
          disabled={busy}
          className="glass-hover min-h-12 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
