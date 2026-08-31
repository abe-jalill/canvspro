import type { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasSync } from "@/hooks/use-canvas-sync";

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

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { sync, isSyncing } = useCanvasSync();
  const retry = onRetry ?? sync;
  return (
    <div className="glass-inset flex flex-col items-start gap-2 p-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
        <p className="text-sm font-medium text-foreground">Couldn't load</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {message ?? "Please try again in a moment."}
      </p>
      <button
        type="button"
        onClick={retry}
        disabled={isSyncing && !onRetry}
        className="glass-hover mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-glass-border px-3 text-xs font-medium"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && !onRetry && "animate-spin")} />
        Try again
      </button>
    </div>
  );
}

export function EmptyState({
  message,
  title,
  icon,
  action,
}: {
  message: string;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="glass-inset flex flex-col items-center justify-center gap-2 p-8 text-center">
      <div className="glass-hover flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
