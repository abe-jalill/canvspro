import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardLayout, type WidgetId, type WidgetSize } from "@/lib/dashboard-layout";
import { WIDGETS } from "@/components/widgets/dashboard-widgets";
import { DashboardHero } from "@/components/dashboard-hero";
import { PageTabs } from "@/components/page-tabs";
import { TODAY_TABS } from "@/lib/page-tab-sets";

import {
  coursesQueryOptions,
  assignmentsQueryOptions,
  calendarQueryOptions,
} from "@/lib/canvas.queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CanvasPro" },
      {
        name: "description",
        content:
          "Your customizable Canvas home: class calendar, grades, assignments, announcements, and focus widgets in one place.",
      },
      { property: "og:title", content: "Dashboard — CanvasPro" },
      {
        property: "og:description",
        content:
          "Your customizable Canvas home: class calendar, grades, assignments, announcements, and focus widgets in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(coursesQueryOptions);
      void context.queryClient.ensureQueryData(assignmentsQueryOptions);
      void context.queryClient.ensureQueryData(calendarQueryOptions);
    }
  },
  component: Dashboard,
});

const SIZE_OPTIONS: { value: WidgetSize; label: string; desc: string }[] = [
  { value: "sm", label: "S", desc: "1/3 width" },
  { value: "md", label: "M", desc: "1/2 width" },
  { value: "full", label: "L", desc: "Full width" },
];

function colSpanClass(size: WidgetSize): string {
  switch (size) {
    case "sm":
      return "col-span-1 md:col-span-1 lg:col-span-4";
    case "md":
      return "col-span-1 md:col-span-1 lg:col-span-6";
    case "full":
    default:
      return "col-span-1 md:col-span-2 lg:col-span-12";
  }
}

function Dashboard() {
  const layout = useDashboardLayout();
  const [customizing, setCustomizing] = useState(false);

  const sizeOf = (id: WidgetId): WidgetSize => layout.sizes[id] ?? WIDGETS[id].defaultSize;

  const visible = layout.order.filter((id) => !layout.isHidden(id));

  return (
    <div className="w-full min-w-0 space-y-4 pb-12 sm:space-y-5">
      <PageTabs tabs={TODAY_TABS} label="Today sections" />
      <DashboardHero />

      <header
        className="premium-reveal flex flex-wrap items-center justify-between gap-3 px-1"
        style={{ animationDelay: "65ms" }}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Your dashboard
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose which widgets appear, their order, and how much room they use.
          </p>
        </div>
        <button
          onClick={() => setCustomizing((value) => !value)}
          type="button"
          aria-expanded={customizing}
          className={cn(
            "glass-hover inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium",
            customizing ? "bg-foreground text-background" : "glass-inset text-foreground",
          )}
        >
          {customizing ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
          {customizing ? "Done" : "Customize widgets"}
        </button>
      </header>

      {customizing && (
        <section className="glass-panel-strong premium-reveal overflow-hidden rounded-2xl border border-primary/20">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3 sm:px-5">
            <div>
              <h3 className="text-sm font-semibold">Edit widgets</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Changes save automatically to your account.
              </p>
            </div>
            <button
              type="button"
              onClick={layout.reset}
              className="glass-hover inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset default
            </button>
          </div>
          <ol className="divide-y divide-foreground/10">
            {layout.order.map((id, index) => {
              const meta = WIDGETS[id];
              const hidden = layout.isHidden(id);
              return (
                <li
                  key={id}
                  className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5"
                >
                  <button
                    type="button"
                    onClick={() => layout.toggle(id)}
                    aria-pressed={!hidden}
                    className="flex min-h-10 min-w-0 items-center gap-3 text-left"
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                        hidden
                          ? "border-foreground/10 text-muted-foreground"
                          : "border-primary/30 bg-primary/10 text-primary",
                      )}
                    >
                      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{meta.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {hidden ? "Hidden" : "Shown on dashboard"}
                      </span>
                    </span>
                  </button>

                  <div
                    className="flex items-center gap-1 rounded-lg border border-foreground/10 bg-background/40 p-1"
                    aria-label={`${meta.label} size`}
                  >
                    {SIZE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => layout.setSize(id, option.value)}
                        aria-pressed={sizeOf(id) === option.value}
                        title={option.desc}
                        className={cn(
                          "h-8 min-w-9 rounded-md px-2 text-xs transition-colors",
                          sizeOf(id) === option.value
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => layout.move(id, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${meta.label} earlier`}
                      className="glass-hover grid h-9 w-9 place-items-center rounded-lg border border-foreground/10 text-muted-foreground disabled:opacity-25"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => layout.move(id, 1)}
                      disabled={index === layout.order.length - 1}
                      aria-label={`Move ${meta.label} later`}
                      className="glass-hover grid h-9 w-9 place-items-center rounded-lg border border-foreground/10 text-muted-foreground disabled:opacity-25"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 min-w-0 [grid-auto-flow:dense]">
        {visible.map((id, index) => {
          const meta = WIDGETS[id];
          return (
            <div
              key={id}
              data-widget-card
              className={cn(
                colSpanClass(sizeOf(id)),
                "premium-card min-w-0 transition-all duration-200",
              )}
              style={{ animationDelay: `${Math.min(index, 5) * 55 + 90}ms` }}
            >
              {meta.render()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
