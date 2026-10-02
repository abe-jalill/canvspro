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
    <nav
      aria-label={label}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-foreground/[0.04] p-1"
    >
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
              "shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm transition-[background-color,color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
              active
                ? "bg-background/80 font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
