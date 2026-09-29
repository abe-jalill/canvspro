import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { useCanvasKey } from "@/lib/user-settings";
import { CanvasTokenWalkthrough } from "@/components/canvas-token-walkthrough";
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

  // Interactive 3-Click Walkthrough directly in place
  return (
    <div className="py-4 sm:py-8">
      <CanvasTokenWalkthrough />
    </div>
  );
}
