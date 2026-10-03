import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchRouteQueries } from "@/lib/canvas.queries";
import { cn } from "@/lib/utils";
import type { PageTab } from "@/lib/page-tab-sets";

/**
 * Quiet in-page navigation for pages that share one sidebar entry.
 * Each tab is a real route, so deep links, push-notification targets and
 * browser back/forward keep working.
 */
export function PageTabs({ tabs, label }: { tabs: PageTab[]; label: string }) {
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    // Centered, so the tabs sit in the same place on every page of a group
    // even when the pages below them have different widths.
    <div className="flex justify-center">
      <nav aria-label={label} className="inline-flex max-w-full gap-2 overflow-x-auto px-1">
        {tabs.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(tab.to + "/");
          return (
            <Link
              key={tab.to}
              to={tab.to}
              preload="intent"
              onMouseEnter={() => prefetchRouteQueries(queryClient, tab.to)}
              onFocus={() => prefetchRouteQueries(queryClient, tab.to)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg border px-4 py-1.5 text-sm transition-colors duration-300 ease-out motion-reduce:transition-none",
                active
                  ? "border-foreground/60 text-foreground"
                  : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
