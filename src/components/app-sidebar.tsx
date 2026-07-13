import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", to: "/" as const },
  { title: "Schedule", to: "/schedule" as const },
  { title: "Grades", to: "/grades" as const },
  { title: "Assignments", to: "/assignments" as const },
  { title: "Announcements", to: "/announcements" as const },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="fixed left-4 top-4 bottom-4 z-30 hidden w-56 flex-col md:flex">
      <div className="glass-panel-strong flex h-full flex-col p-5">
        <div className="mb-8 px-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Canvas
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">
            Student
          </h1>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "glass-hover rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground/[0.08] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="glass-panel-strong sticky top-2 z-30 mx-2 mt-2 flex gap-1 overflow-x-auto p-2 md:hidden">
      {items.map((item) => {
        const active =
          item.to === "/"
            ? pathname === "/"
            : pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium",
              active
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted-foreground",
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </div>
  );
}
