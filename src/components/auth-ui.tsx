import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { HomeFooter } from "@/components/home-footer";
import "@/routes/home.css";
import "@/routes/auth.css";

/**
 * Sign-in, sign-up, password and consent pages, in the homepage's design:
 * the same top bar, type and colors, a heading on the left and the form on
 * the right. auth.css maps the app's color tokens to the homepage palette, so
 * the forms inside keep working unchanged.
 */
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
    <div className="hp hp-auth">
      {/* React hoists this into <head>; it's the homepage's one typeface. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..800&display=swap"
        precedence="default"
      />
      <header className="hp-bar">
        <Link to="/" className="hp-brand" aria-label="CanvasPro home">
          CanvasPro
        </Link>
        <nav className="hp-bar__links" aria-label="Main navigation">
          <Link to="/" className="hp-bar__secondary">
            Home
          </Link>
          <Link to="/canvas-grade-calculator" className="hp-bar__secondary">
            Grade calculator
          </Link>
        </nav>
      </header>
      <main className="hp-auth__main">
        <div className="hp-auth__intro hp-rise">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className={cn("hp-auth__form hp-rise", className)}>
          {children}
          {footer && <div className="hp-auth__footer">{footer}</div>}
        </div>
      </main>
      <HomeFooter />
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
    <label className="hp-field">
      <span className="hp-field__label">{label}</span>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn("hp-field__input", isPassword && "pr-12")}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="hp-field__toggle"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </label>
  );
}
