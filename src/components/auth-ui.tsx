import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import "@/routes/public-pages.css";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className="cp-auth">
      <div className="cp-auth__layout">
        <aside className="cp-auth__story" aria-label="About CanvasPro">
          <Link to="/" className="cp-auth__brand">
            canvaspro<span>.</span>
          </Link>
          <div className="cp-auth__story-body">
            <span>YOUR DAY, IN FOCUS</span>
            <h2>
              Make room for
              <br />
              <em>what matters.</em>
            </h2>
            <p>Your classes, deadlines, and next steps can finally live together.</p>
            <div className="cp-auth__mini-plan" aria-hidden="true">
              <small>TODAY'S PLAN</small>
              <div>
                <i /> Physics Homework <span>30 min</span>
              </div>
              <div>
                <i /> CAD Assignment <span>45 min</span>
              </div>
              <div>
                <i /> English Reading <span>25 min</span>
              </div>
            </div>
          </div>
          <span className="cp-auth__aside-note">A CLEARER WAY THROUGH THE SEMESTER</span>
        </aside>
        <div
          className={cn("cp-auth__panel auth-shell-panel w-full max-w-md p-6 sm:p-8", className)}
        >
          <div className="mb-6">
            <Link to="/" className="cp-auth__mobile-brand">
              canvaspro<span>.</span>
            </Link>
            <p className="text-xs font-normal uppercase tracking-[0.18em] text-muted-foreground">
              Your space
            </p>
            <h1 className="mt-2 text-2xl font-normal tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="mt-6">{footer}</div>}
        </div>
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
  minLength,
  required = true,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;

  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "glass-inset min-h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20",
            isPassword && "pr-12",
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </label>
  );
}
