import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  strong?: boolean;
}

export function GlassCard({
  children,
  className,
  title,
  subtitle,
  action,
  strong,
}: GlassCardProps) {
  return (
    <section
      className={cn(
        strong ? "glass-panel-strong" : "glass-panel",
        "min-w-0 overflow-hidden p-4 sm:p-6 md:p-7",
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
            )}
          </div>
          {action ? <div className="shrink-0">{action}</div> : <span />}
        </header>
      )}

      {children}
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer h-4 w-full", className)} />;
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="glass-inset flex flex-col items-start gap-1 p-4">
      <p className="text-sm font-medium text-foreground">Couldn't load</p>
      <p className="text-xs text-muted-foreground">
        {message ?? "Please try again in a moment."}
      </p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass-inset flex items-center justify-center p-8 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
