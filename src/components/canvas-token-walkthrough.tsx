import { useState, useEffect, useId, type FormEvent } from "react";
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Shield,
  KeyRound,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  School,
  Lock,
  LoaderCircle,
  Copy,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSaveCanvasKey, useCanvasDomain, normalizeCanvasDomain } from "@/lib/user-settings";
import { detectCanvasDomainFromEmail, getCanvasTokenSettingsUrl } from "@/lib/school-domains";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CanvasTokenWalkthroughProps {
  onSuccess?: () => void;
  className?: string;
  initialStep?: 1 | 2 | 3;
}

export function CanvasTokenWalkthrough({
  onSuccess,
  className,
  initialStep = 1,
}: CanvasTokenWalkthroughProps) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [schoolDomain, setSchoolDomain] = useState("");
  const [detectedSchoolName, setDetectedSchoolName] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [showSecurityFaq, setShowSecurityFaq] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: savedDomain } = useCanvasDomain();
  const saveKey = useSaveCanvasKey();
  const tokenInputId = useId();
  const domainInputId = useId();

  // 1. Fetch user email to auto-detect school
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (email) {
        setUserEmail(email);
        const detected = detectCanvasDomainFromEmail(email);
        if (detected) {
          setDetectedSchoolName(detected.schoolName);
          setSchoolDomain((current) => current || detected.canvasDomain);
        }
      }
    });
  }, []);

  // 2. Pre-fill saved domain if present
  useEffect(() => {
    if (savedDomain) setSchoolDomain((current) => current || savedDomain);
  }, [savedDomain]);

  const activeCanvasUrl = schoolDomain.trim()
    ? normalizeCanvasDomain(schoolDomain)
    : "yourschool.instructure.com";

  const directTokenUrl = getCanvasTokenSettingsUrl(activeCanvasUrl);

  const handleTestAndSave = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanToken = tokenInput.trim();
    const cleanDomain = normalizeCanvasDomain(schoolDomain);

    if (!cleanDomain) {
      setErrorMessage(
        "Please specify your school's Canvas URL first (e.g. yourschool.instructure.com).",
      );
      setStep(1);
      return;
    }

    if (!cleanToken) {
      setErrorMessage("Please paste your Canvas Access Token.");
      return;
    }

    if (cleanToken.startsWith("http://") || cleanToken.startsWith("https://")) {
      setErrorMessage(
        "That looks like a web URL instead of an API token. Canvas tokens look like 7~xxxxxxxx or alphanumeric strings.",
      );
      return;
    }

    setIsVerifying(true);
    try {
      await saveKey.mutateAsync({
        key: cleanToken,
        domain: cleanDomain,
      });

      setVerifiedSuccess(true);
      toast.success("Connected to Canvas successfully!");
      if (onSuccess) {
        setTimeout(onSuccess, 1400);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to verify token.";
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className={cn(
        "glass-panel-strong relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl p-6 sm:p-8 shadow-glass transition-all",
        className,
      )}
    >
      {/* Top Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>3-Click Canvas Setup</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">Step {step} of 3</span>
        </div>

        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {step === 1 && "Find Your School's Canvas"}
          {step === 2 && "Generate Your Access Token"}
          {step === 3 && "Paste & Connect"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {step === 1 &&
            "Confirm your university web address so we can route you directly to token creation."}
          {step === 2 &&
            "Create a personal access token in Canvas to sync your classes, grades, and due dates."}
          {step === 3 &&
            "Paste your token here. We test the connection immediately to make sure it works."}
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="my-6 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s as 1 | 2 | 3)}
            className="group flex flex-col gap-1 text-left"
          >
            <div
              className={cn(
                "h-1.5 w-full rounded-full transition-all duration-300",
                step >= s
                  ? "bg-primary shadow-status-live"
                  : "bg-foreground/10 group-hover:bg-foreground/20",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider transition-colors",
                step === s ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s === 1 ? "1. School" : s === 2 ? "2. Token" : "3. Connect"}
            </span>
          </button>
        ))}
      </div>

      {/* STEP 1: School Domain & Direct Link */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <label htmlFor={domainInputId} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your School Canvas URL
              </span>
              <div className="relative">
                <School className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id={domainInputId}
                  type="text"
                  value={schoolDomain}
                  onChange={(e) => setSchoolDomain(e.target.value)}
                  placeholder="e.g. yourschool.instructure.com"
                  className="glass-inset min-h-12 w-full rounded-xl bg-transparent pl-10 pr-4 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-foreground/20"
                />
              </div>
            </label>

            {detectedSchoolName && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Detected from your email: <strong>{detectedSchoolName}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Interactive Visual Canvas Mockup for Step 1 */}
          <div className="glass-panel overflow-hidden rounded-2xl border border-foreground/10 p-4">
            <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground">
              <Info className="h-4 w-4 text-primary" />
              <span>Where to click in Canvas:</span>
            </div>

            {/* Visual Canvas Sidebar Mockup */}
            <div className="flex rounded-xl bg-[#2D3B45] text-white p-3 shadow-inner overflow-hidden select-none">
              {/* Canvas Left Global Nav */}
              <div className="w-16 shrink-0 flex flex-col items-center gap-4 py-2 border-r border-white/10">
                <div className="relative group">
                  <div className="h-9 w-9 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center ring-4 ring-primary/30 animate-pulse">
                    <KeyRound className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[10px] block text-center mt-1 font-semibold text-primary">
                    Account
                  </span>
                  {/* Visual callout arrow */}
                  <div className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    1
                  </div>
                </div>
                <div className="opacity-40 flex flex-col items-center gap-1">
                  <div className="h-6 w-6 rounded bg-white/20" />
                  <span className="text-[9px]">Dashboard</span>
                </div>
                <div className="opacity-40 flex flex-col items-center gap-1">
                  <div className="h-6 w-6 rounded bg-white/20" />
                  <span className="text-[9px]">Courses</span>
                </div>
              </div>

              {/* Flyout panel */}
              <div className="pl-4 flex-1 py-1 flex flex-col justify-center">
                <div className="text-xs font-semibold text-white/90 mb-2">Student Account Menu</div>
                <div className="space-y-1.5 text-xs text-white/70 max-w-xs">
                  <div className="px-2 py-1 rounded bg-white/5 opacity-60">Notifications</div>
                  <div className="px-2 py-1 rounded bg-white/5 opacity-60">Profile</div>
                  <div className="px-2 py-1.5 rounded-lg bg-primary/20 border border-primary/40 font-semibold text-white flex items-center justify-between">
                    <span>Settings</span>
                    <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                      Click here
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
            <a
              href={directTokenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-inset glass-hover inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-4 text-xs font-medium text-foreground transition"
            >
              <span>Open Canvas in New Tab</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="glass-hover inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition"
            >
              <span>Continue to Step 2</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Generate Access Token */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 text-xs leading-relaxed text-muted-foreground space-y-2">
            <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>In Canvas Settings:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>
                Scroll down to the <strong>Approved Integrations</strong> section.
              </li>
              <li>
                Click the blue <strong>+ New Access Token</strong> button.
              </li>
              <li>
                Under Purpose, type <strong>CanvasPro</strong>.
              </li>
              <li>
                Leave the <em>Expires</em> field blank (so your connection stays active).
              </li>
              <li>
                Click <strong>Generate Token</strong> and copy the revealed token string.
              </li>
            </ol>
          </div>

          {/* Canvas Dialog Mockup */}
          <div className="rounded-2xl border border-foreground/10 bg-background/50 p-4 shadow-inner space-y-3">
            <div className="flex items-center justify-between border-b border-foreground/10 pb-2">
              <span className="text-xs font-bold text-foreground">New Access Token Dialog</span>
              <span className="text-[10px] text-muted-foreground">Canvas LMS Preview</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-muted-foreground block mb-1">Purpose:</span>
                <div className="rounded-lg border border-foreground/15 bg-background px-3 py-1.5 font-mono text-foreground font-medium">
                  CanvasPro
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block mb-1">Expires:</span>
                <div className="rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-muted-foreground italic">
                  Leave blank (Never expires)
                </div>
              </div>

              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 flex items-center justify-between text-emerald-400">
                <span className="font-mono text-[11px] truncate">7~9814abcde1234567890f...</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded">
                  Copy this
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="glass-inset glass-hover inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-4 text-xs font-medium text-foreground transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
              <a
                href={directTokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-inset glass-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-medium text-foreground transition"
              >
                <span>Open Token Page ↗</span>
              </a>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="glass-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition"
              >
                <span>I Have My Token</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Connect & Test */}
      {step === 3 && (
        <form onSubmit={handleTestAndSave} className="space-y-6">
          <div className="space-y-3">
            <label htmlFor={tokenInputId} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Paste Canvas Access Token
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
                  placeholder="Paste the token here (e.g. 7~xxxxxxxxxxxx)"
                  autoComplete="off"
                  disabled={isVerifying || verifiedSuccess}
                  className="glass-inset min-h-12 w-full rounded-xl bg-transparent pl-10 pr-4 text-base font-mono text-foreground outline-none placeholder:text-muted-foreground/50 placeholder:font-sans focus:ring-1 focus:ring-foreground/20"
                />
              </div>
            </label>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Connecting to: <strong>{activeCanvasUrl}</strong>
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="underline hover:text-foreground"
              >
                Change school
              </button>
            </div>
          </div>

          {/* Inline Validation Status */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Verification problem</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {verifiedSuccess && (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-sm">Canvas Connected!</p>
                <p>Loading your courses, assignments, and grades now…</p>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={isVerifying || verifiedSuccess}
              className="glass-inset glass-hover inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-4 text-xs font-medium text-foreground transition disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <button
              type="submit"
              disabled={isVerifying || verifiedSuccess || !tokenInput.trim()}
              className="glass-hover inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Testing Connection…</span>
                </>
              ) : verifiedSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Connect & Load Classes</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Security & Privacy Accordion Footer */}
      <div className="mt-8 border-t border-foreground/10 pt-4">
        <button
          type="button"
          onClick={() => setShowSecurityFaq(!showSecurityFaq)}
          className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Is my Canvas API token secure?
          </span>
          <span className="text-[11px] underline">
            {showSecurityFaq ? "Hide security info" : "Learn more"}
          </span>
        </button>

        {showSecurityFaq && (
          <div className="mt-3 rounded-2xl bg-foreground/[0.03] border border-foreground/10 p-4 text-xs text-muted-foreground space-y-2">
            <p>
              <strong>🔒 Official Instructure Feature:</strong> Personal Access Tokens are standard
              Canvas functionality designed specifically for third-party student companion apps.
            </p>
            <p>
              <strong>🛡️ Zero Password Access:</strong> CanvasPro never sees or stores your
              university password. The token only grants access to what your student account is
              already authorized to view.
            </p>
            <p>
              <strong>🔑 You Stay in Control:</strong> Your token is encrypted at rest in your
              personal database row scoped by Row Level Security. You can revoke it at any second in
              Canvas under <em>Settings → Approved Integrations → Delete</em>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
