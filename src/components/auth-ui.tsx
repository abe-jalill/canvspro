import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      <div className={cn("glass-panel-strong w-full max-w-md p-6 sm:p-8", className)}>
        <div className="mb-6">
          <p className="text-xs font-normal uppercase tracking-[0.18em] text-muted-foreground">Canvas Pro</p>
          <h1 className="mt-2 text-2xl font-normal tracking-tight">{title}</h1>
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
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="glass-inset min-h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20"
      />
    </label>
  );
}
