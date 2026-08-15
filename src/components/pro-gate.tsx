import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useSubscription } from "@/lib/subscription";

/** Routes available on the free tier. Everything else requires Canvas Pro. */
export const FREE_PATHS = ["/", "/billing", "/settings", "/checkout"] as const;

export function isFreePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return FREE_PATHS.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")));
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
            Canvas Pro for $2.99/month.
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
  if (isLoading) return null;
  if (isActive) return <>{children}</>;
  return <UpgradeCard />;
}
