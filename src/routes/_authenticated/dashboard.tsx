import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, RotateCcw, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardLayout, type WidgetId } from "@/lib/dashboard-layout";
import { WIDGETS, LockedWidget } from "@/components/widgets/dashboard-widgets";
import { useSubscription } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Canvas Pro" },
      {
        name: "description",
        content:
          "Your customizable Canvas home: class calendar, grades, assignments, announcements, and focus widgets in one place.",
      },
      { property: "og:title", content: "Dashboard — Canvas Pro" },
      {
        property: "og:description",
        content:
          "Your customizable Canvas home: class calendar, grades, assignments, announcements, and focus widgets in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const layout = useDashboardLayout();
  const { isActive: isPro } = useSubscription();
  const [customizing, setCustomizing] = useState(false);
  const [dragId, setDragId] = useState<WidgetId | null>(null);

  const visible = layout.order.filter((id) => !layout.isHidden(id));

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 px-1 pt-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Overview
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            Dashboard
          </h1>
        </div>
        <button
          onClick={() => setCustomizing((v) => !v)}
          aria-pressed={customizing}
          className="glass-inset glass-hover inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {customizing ? "Done" : "Customize"}
        </button>
      </header>


      {customizing && (
        <section className="glass-panel-strong p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Widgets</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Show, hide, and reorder. Saved to this browser for your account.
              </p>
            </div>
            <button
              onClick={layout.reset}
              className="glass-hover inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {layout.order.map((id, index) => {
              const meta = WIDGETS[id];
              const hidden = layout.isHidden(id);
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={() => setDragId(id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId && dragId !== id) layout.reorder(dragId, index);
                    setDragId(null);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={cn(
                    "glass-inset flex items-center gap-2 p-3",
                    hidden && "opacity-55",
                    dragId === id && "ring-1 ring-foreground/30",
                  )}
                >
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {meta.label}
                    {meta.pro && !isPro && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Pro
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => layout.move(id, -1)}
                    aria-label={`Move ${meta.label} up`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => layout.move(id, 1)}
                    aria-label={`Move ${meta.label} down`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => layout.toggle(id)}
                    aria-label={hidden ? `Show ${meta.label}` : `Hide ${meta.label}`}
                    aria-pressed={!hidden}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {visible.map((id) => {
          const meta = WIDGETS[id];
          return (
            <div key={id} className={cn(meta.wide && "md:col-span-2")}>
              {meta.pro && !isPro ? (
                <LockedWidget title={meta.label} feature={meta.label} />
              ) : (
                meta.render()
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
