import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardLayout, type WidgetId, type WidgetSize } from "@/lib/dashboard-layout";
import { WIDGETS, LockedWidget } from "@/components/widgets/dashboard-widgets";
import { MasonryGrid } from "@/components/widgets/masonry-grid";
import { useSubscription } from "@/lib/subscription";
import { DashboardHero } from "@/components/dashboard-hero";

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

const SIZE_OPTIONS: { value: WidgetSize; label: string }[] = [
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "full", label: "L" },
];

function Dashboard() {
  const layout = useDashboardLayout();
  const { isActive: isPro } = useSubscription();
  const [customizing, setCustomizing] = useState(false);
  const [dragId, setDragId] = useState<WidgetId | null>(null);

  const sizeOf = (id: WidgetId): WidgetSize => layout.sizes[id] ?? WIDGETS[id].defaultSize;

  const visible = layout.order.filter((id) => !layout.isHidden(id));
  const source = customizing ? layout.order : visible;

  const items = source.map((id) => {
    const meta = WIDGETS[id];
    const hidden = layout.isHidden(id);
    const index = layout.order.indexOf(id);
    const body =
      meta.pro && !isPro ? <LockedWidget title={meta.label} feature={meta.label} /> : meta.render();

    return {
      key: id,
      size: sizeOf(id),
      node: customizing ? (
        <div
          draggable
          onDragStart={() => setDragId(id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragId && dragId !== id) layout.reorder(dragId, index);
            setDragId(null);
          }}
          onDragEnd={() => setDragId(null)}
          className={cn(
            "relative rounded-2xl ring-1 ring-foreground/10 transition",
            hidden && "opacity-40",
            dragId === id && "ring-2 ring-foreground/40",
          )}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-foreground/10 px-3 py-2">
            <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground sm:block" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
              {meta.label}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => layout.move(id, -1)}
                disabled={index === 0}
                aria-label={`Move ${meta.label} up`}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => layout.move(id, 1)}
                disabled={index === layout.order.length - 1}
                aria-label={`Move ${meta.label} down`}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <span className="flex items-center gap-0.5 rounded-lg border border-foreground/15 p-0.5">
                {SIZE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => layout.setSize(id, o.value)}
                    aria-label={`Set ${meta.label} size ${o.label}`}
                    aria-pressed={sizeOf(id) === o.value}
                    className={cn(
                      "h-8 w-8 rounded-md text-[11px] font-semibold text-muted-foreground transition-colors",
                      sizeOf(id) === o.value && "bg-foreground/10 text-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </span>
              <button
                onClick={() => layout.toggle(id)}
                aria-label={hidden ? `Show ${meta.label}` : `Hide ${meta.label}`}
                aria-pressed={!hidden}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground"
              >
                {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </div>

          <div className="pointer-events-none p-1">{body}</div>
        </div>
      ) : (
        body
      ),
    };
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <DashboardHero />

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">Your widgets</h2>
          {customizing && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Drag to reorder, pick a size, hide what you don&apos;t need.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {customizing && (
            <button
              onClick={layout.reset}
              className="glass-hover inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button
            onClick={() => setCustomizing((v) => !v)}
            aria-pressed={customizing}
            className="glass-inset glass-hover inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {customizing ? "Done" : "Customize"}
          </button>
        </div>
      </header>

      <MasonryGrid items={items} />
    </div>
  );
}
