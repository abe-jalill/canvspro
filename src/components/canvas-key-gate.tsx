import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, KeyRound } from "lucide-react";
import { useCanvasKey } from "@/lib/user-settings";
import { SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";

/**
 * Blocks every page except Settings until the signed-in user has saved their
 * own Canvas API key, so no other account's data is ever rendered.
 */
export function CanvasKeyGate({ children }: { children: ReactNode }) {
  const { data: key, isLoading, isError, refetch } = useCanvasKey();
  const { pathname } = useLocation();

  if (["/settings", "/study-session", "/notifications", "/admin"].some((path) => pathname.startsWith(path))) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading your Canvas workspace" className="w-full space-y-6">
        {/* Hero banner skeleton */}
        <div className="glass-panel overflow-hidden rounded-[2rem] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-3.5 w-32" />
          </div>
          <div className="space-y-2 py-4">
            <SkeletonBlock className="h-10 w-3/4 max-w-lg" />
            <SkeletonBlock className="h-4 w-1/2 max-w-sm" />
          </div>
          <SkeletonBlock className="h-10 w-36 rounded-full" />
        </div>

        {/* Dashboard 2-column grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <SkeletonBlock className="h-5 w-40 mb-4" />
            <SkeletonBlock className="h-12 rounded-xl" />
            <SkeletonBlock className="h-12 rounded-xl" />
            <SkeletonBlock className="h-12 rounded-xl" />
          </div>
          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <SkeletonBlock className="h-5 w-48 mb-4" />
            <SkeletonBlock className="h-12 rounded-xl" />
            <SkeletonBlock className="h-12 rounded-xl" />
            <SkeletonBlock className="h-12 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (key) return <>{children}</>;

  if (isError) {
    return (
      <div role="status" className="glass-panel p-6 text-sm flex items-center justify-between">
        <span>Could not check your Canvas connection.</span>
        <button
          type="button"
          onClick={() => void refetch()}
          className="glass-hover rounded-lg px-3 py-1.5 font-medium underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // One message, one button: the steps themselves live on Settings → Canvas.
  return (
    <div className="py-6 sm:py-12">
      <div className="glass-panel-strong mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-3xl p-6 text-center sm:p-8">
        <span className="glass-inset flex h-12 w-12 items-center justify-center rounded-2xl text-primary">
          <KeyRound className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            One quick step to start
          </h2>
          <p className="text-sm text-muted-foreground">
            In order to start, you need to enter your Canvas API key in Settings. It takes about a
            minute.
          </p>
        </div>
        <Link
          to="/settings/canvas"
          className="glass-hover inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background sm:w-auto"
        >
          <span>Go to Settings</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
