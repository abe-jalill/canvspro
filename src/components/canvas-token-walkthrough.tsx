import { useState, useEffect, useId, type FormEvent } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  School,
  LoaderCircle,
  Laptop,
} from "lucide-react";
import { useSaveCanvasKey, useCanvasDomain, normalizeCanvasDomain } from "@/lib/user-settings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CanvasTokenWalkthroughProps {
  onSuccess?: () => void;
  className?: string;
  initialStep?: 1 | 2;
}

/** Connecting Canvas in two steps: the school's address, then a token made in Canvas. */
export function CanvasTokenWalkthrough({
  onSuccess,
  className,
  initialStep = 1,
}: CanvasTokenWalkthroughProps) {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [schoolDomain, setSchoolDomain] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showSecurityFaq, setShowSecurityFaq] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: savedDomain } = useCanvasDomain();
  const saveKey = useSaveCanvasKey();
  const tokenInputId = useId();
  const domainInputId = useId();

  // Only the saved address is filled in. Never guessed from the email: a
  // school's email domain often isn't its Canvas address.
  useEffect(() => {
    if (savedDomain) setSchoolDomain((current) => current || savedDomain);
  }, [savedDomain]);

  const cleanDomain = normalizeCanvasDomain(schoolDomain);

  const goToToken = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!cleanDomain) {
      setErrorMessage("Enter your school's Canvas address, e.g. yourschool.instructure.com.");
      return;
    }
    setErrorMessage(null);
    setStep(2);
  };

  const handleTestAndSave = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    const cleanToken = tokenInput.trim();

    if (!cleanDomain) {
      setErrorMessage("Enter your school's Canvas address first.");
      setStep(1);
      return;
    }
    if (!cleanToken) {
      setErrorMessage("Paste your Canvas access token.");
      return;
    }
    if (cleanToken.startsWith("http://") || cleanToken.startsWith("https://")) {
      setErrorMessage(
        "That looks like a web address, not a token. Canvas tokens look like 7~xxxxxxxx.",
      );
      return;
    }

    setIsVerifying(true);
    try {
      await saveKey.mutateAsync({ key: cleanToken, domain: cleanDomain });
      setVerifiedSuccess(true);
      toast.success("Connected to Canvas.");
      if (onSuccess) setTimeout(onSuccess, 1400);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't verify the token.");
    } finally {
      setIsVerifying(false);
    }
  };

  const inputClass =
    "glass-inset min-h-12 w-full rounded-xl bg-transparent pl-10 pr-4 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-foreground/20";
  const primaryClass =
    "glass-hover inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition disabled:opacity-50";
  const quietClass =
    "glass-inset glass-hover inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-4 text-xs font-medium text-foreground transition disabled:opacity-50";

  return (
    <div
      className={cn(
        "glass-panel-strong relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl p-6 sm:p-8 shadow-glass transition-all",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Connect Canvas
          </span>
          <span className="text-xs font-medium text-muted-foreground">Step {step} of 2</span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {step === 1 ? "Your school" : "Your access token"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {step === 1
            ? "The address you use to open Canvas."
            : "In Canvas: Account, Settings, Approved Integrations, New Access Token. Copy it and paste it below."}
        </p>
        {/* Copying a token is fiddly on a phone; one connection covers every device. */}
        <p className="mt-2 flex items-start gap-2.5 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3.5 py-3 text-sm text-muted-foreground">
          <Laptop className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">Easiest on a computer.</span> Connect once
            at canvaspro.app and the CoursePro iPhone app syncs automatically, with nothing to enter
            there.
          </span>
        </p>
      </div>

      <div className="my-6 grid grid-cols-2 gap-2">
        {([1, 2] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => (s === 2 ? goToToken() : setStep(1))}
            disabled={isVerifying || verifiedSuccess}
            className="group flex flex-col gap-1 text-left"
          >
            <div
              className={cn(
                "h-1.5 w-full rounded-full transition-all duration-300",
                step >= s ? "bg-primary" : "bg-foreground/10 group-hover:bg-foreground/20",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider transition-colors",
                step === s ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s === 1 ? "1. School" : "2. Token"}
            </span>
          </button>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={goToToken} className="space-y-6">
          <div className="space-y-3">
            <label htmlFor={domainInputId} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Canvas address
              </span>
              <div className="relative">
                <School className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id={domainInputId}
                  type="text"
                  value={schoolDomain}
                  onChange={(e) => {
                    setSchoolDomain(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="yourschool.instructure.com"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputClass}
                />
              </div>
            </label>
          </div>
          {errorMessage && <ErrorNote message={errorMessage} />}
          <div className="flex justify-end pt-2">
            <button type="submit" className={primaryClass}>
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleTestAndSave} className="space-y-6">
          <div className="space-y-3">
            <label htmlFor={tokenInputId} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Access token
              </span>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id={tokenInputId}
                  type="password"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Paste the token (7~xxxxxxxx)"
                  autoComplete="off"
                  autoFocus
                  disabled={isVerifying || verifiedSuccess}
                  className={cn(inputClass, "font-mono placeholder:font-sans")}
                />
              </div>
            </label>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Connecting to <strong>{cleanDomain}</strong>
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isVerifying || verifiedSuccess}
                className="underline hover:text-foreground"
              >
                Change school
              </button>
            </div>
          </div>

          {errorMessage && <ErrorNote message={errorMessage} />}
          {verifiedSuccess && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="space-y-0.5 text-xs">
                <p className="text-sm font-semibold">Canvas connected</p>
                <p>Loading your classes, assignments and grades…</p>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse items-center justify-between gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={isVerifying || verifiedSuccess}
              className={quietClass}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <button
              type="submit"
              disabled={isVerifying || verifiedSuccess || !tokenInput.trim()}
              className={primaryClass}
            >
              {isVerifying ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Checking Canvas…</span>
                </>
              ) : verifiedSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Connect Canvas</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 border-t border-foreground/10 pt-4">
        <button
          type="button"
          onClick={() => setShowSecurityFaq(!showSecurityFaq)}
          className="flex w-full items-center justify-between text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Is my token secure?
          </span>
          <span className="text-[11px] underline">{showSecurityFaq ? "Hide" : "Learn more"}</span>
        </button>
        {showSecurityFaq && (
          <div className="mt-3 space-y-2 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 text-xs text-muted-foreground">
            <p>
              Access tokens are a standard Canvas feature. CoursePro never sees your school
              password, and the token only reaches what your account can already see.
            </p>
            <p>
              Your token is stored encrypted and only your account can use it. Revoke it any time in
              Canvas under Settings, Approved Integrations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
