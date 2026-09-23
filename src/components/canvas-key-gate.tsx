import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useCanvasKey } from "@/lib/user-settings";

/**
 * Blocks every page except Settings until the signed-in user has saved their
 * own Canvas API key, so no other account's data is ever rendered.
 */
export function CanvasKeyGate({ children }: { children: ReactNode }) {
  const { data: key, isLoading, isError, refetch } = useCanvasKey();
  const { pathname } = useLocation();

  if (["/settings", "/study-session", "/notifications"].some((path) => pathname.startsWith(path))) return <>{children}</>;
  if (isLoading) return (
    <div role="status" className="glass-panel min-h-48 space-y-4 p-6">
      <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      <div className="h-4 w-2/3 rounded bg-foreground/5 motion-safe:animate-pulse" />
      <div className="h-24 rounded-xl bg-foreground/5 motion-safe:animate-pulse" />
    </div>
  );
  if (key) return <>{children}</>;
  if (isError) return <div role="status" className="glass-panel p-6 text-sm">
    Could not check your Canvas connection. <button type="button" onClick={() => void refetch()} className="underline">Try again</button>
  </div>;

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="glass-panel-strong flex flex-col items-start gap-4 p-6">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Connect your Canvas account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your own Canvas API key to load your courses, grades, and
            assignments. Nothing is shown until you connect.
          </p>
        </div>
        <Link
          to="/settings"
          className="glass-hover inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-background"
        >
          Open Settings
        </Link>
      </div>
    </div>
  );
}
