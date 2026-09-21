import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useSubscription } from "@/lib/subscription";

/** Routes available on the free tier. Everything else requires Canvas Pro. */
export const FREE_PATHS = ["/dashboard", "/billing", "/settings", "/notifications", "/checkout"] as const;

export function isFreePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return FREE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function UpgradeCard({ feature }: { feature?: string }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="glass-panel-strong flex flex-col items-start gap-4 p-6">
        <Lock className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {feature ? `${feature} is a Pro feature` : "This is a Pro feature"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The free tier includes the Dashboard. Unlock Focus, Calendar, Class
            Schedule, Grades, Assignments, Announcements, and notifications with
            Canvas Pro — first 10 days free, then $2.99/month or $30/year (save 17%!).
          </p>
        </div>
        <Link
          to="/billing"
          className="glass-hover inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-background"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}

/** Blocks non-dashboard pages until the user has an active subscription. */
export function ProGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { isActive, isLoading } = useSubscription();

  if (isFreePath(pathname)) return <>{children}</>;
  // Fail closed: unlock only on a confirmed active subscription. While the
  // check is loading we render nothing; if it failed we show the upgrade card.
  if (isLoading) return null;
  if (isActive) return <>{children}</>;
  return <UpgradeCard />;
}
