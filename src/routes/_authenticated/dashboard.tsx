import { createFileRoute } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardLayout, type WidgetId, type WidgetSize } from "@/lib/dashboard-layout";
import { WIDGETS, LockedWidget } from "@/components/widgets/dashboard-widgets";
import { useSubscription } from "@/lib/subscription";
import { DashboardHero } from "@/components/dashboard-hero";
import { isNativeApp } from "@/lib/native";

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
  const { isActive: isPro } = useSubscription();
  const nativeApp = isNativeApp();
  const [customizing, setCustomizing] = useState(false);
  const [activeWidget, setActiveWidget] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [draggedId, setDraggedId] = useState<WidgetId | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    id: WidgetId;
    position: "before" | "after";
  } | null>(null);

  // Long-press (2s) on empty space in the widgets area enters edit mode.
  // Pressing on a widget itself never triggers it. Small finger/mouse jitter is
  // tolerated — only a real drag (>12px) cancels the hold.
  const longPressTimer = useRef<number | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    longPressOrigin.current = null;
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleAreaPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (customizing) return;
    if ((e.target as HTMLElement).closest("[data-widget-card]")) return;
    clearLongPress();
    longPressOrigin.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      longPressOrigin.current = null;
      setCustomizing(true);
    }, 2000);
  };

  const handleAreaPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const origin = longPressOrigin.current;
    if (!origin || longPressTimer.current === null) return;
    const moved = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);
    if (moved > 12) clearLongPress();
  };

  const sizeOf = (id: WidgetId): WidgetSize => layout.sizes[id] ?? WIDGETS[id].defaultSize;

  const visible = layout.order.filter((id) => !layout.isHidden(id));
  const activeList = customizing ? layout.order : visible;
  const hiddenWidgets = layout.order.filter((id) => layout.isHidden(id));
  const showCarousel = nativeApp && !customizing;

  useEffect(() => {
    setActiveWidget((current) => Math.min(current, Math.max(activeList.length - 1, 0)));
  }, [activeList.length]);

  const handleCarouselScroll = () => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const slides = Array.from(carousel.querySelectorAll<HTMLElement>("[data-widget-slide]"));
    if (slides.length === 0) return;

    const firstOffset = slides[0]?.offsetLeft ?? 0;
    const nearest = slides.reduce(
      (best, slide, index) => {
        const distance = Math.abs(slide.offsetLeft - firstOffset - carousel.scrollLeft);
        return distance < best.distance ? { index, distance } : best;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    );
    setActiveWidget(nearest.index);
  };

  const goToWidget = (index: number) => {
    const carousel = carouselRef.current;
    const slides = carousel?.querySelectorAll<HTMLElement>("[data-widget-slide]");
    const slide = slides?.[index];
    const firstSlide = slides?.[0];
    if (!carousel || !slide || !firstSlide) return;
    carousel.scrollTo({ left: slide.offsetLeft - firstSlide.offsetLeft, behavior: "smooth" });
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: WidgetId) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, targetId: WidgetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "before" : "after";

    setDropIndicator({ id: targetId, position });
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropIndicator(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetId: WidgetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDropIndicator(null);
      return;
    }

    const currentOrder = [...layout.order];
    const fromIndex = currentOrder.indexOf(draggedId);
    let toIndex = currentOrder.indexOf(targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      if (dropIndicator?.position === "after") {
        toIndex = fromIndex < toIndex ? toIndex : toIndex + 1;
      } else {
        toIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      }
      toIndex = Math.max(0, Math.min(toIndex, currentOrder.length - 1));
      layout.reorder(draggedId, toIndex);
    }

    setDraggedId(null);
    setDropIndicator(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDropIndicator(null);
  };

  return (
    <div
      className="w-full min-w-0 space-y-6 pb-12"
      onPointerDown={handleAreaPointerDown}
      onPointerUp={clearLongPress}
      onPointerMove={handleAreaPointerMove}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
    >
      <DashboardHero />

      {/* Customization Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Your Widgets
            </h2>
            {customizing && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Edit Mode
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {customizing
              ? "Drag cards or use arrows to arrange. Choose sizes or hide widgets you don't need."
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {customizing && (
            <>
              <button
                onClick={layout.reset}
                type="button"
                className="glass-hover inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Layout
              </button>

              <button
                onClick={() => setCustomizing(false)}
                type="button"
                className="glass-hover inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition"
              >
                Save Layout
              </button>
            </>
          )}
        </div>
      </header>

      {/* Instructions banner */}
      {customizing && (
        <div className="glass-panel rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-primary" />
            <span>
              <strong className="text-foreground">Drag by the handle</strong> to move widgets, or
              tap <strong className="text-foreground">↑ / ↓</strong> arrows to reorder.
            </span>
          </div>
          <span className="text-muted-foreground">Changes save automatically to your account.</span>
        </div>
      )}

      {/* The native app uses an iOS-style pager; web keeps the customizable grid. */}
      <div
        ref={carouselRef}
        onScroll={showCarousel ? handleCarouselScroll : undefined}
        role={showCarousel ? "region" : undefined}
        aria-label={showCarousel ? "Dashboard widgets" : undefined}
        aria-roledescription={showCarousel ? "carousel" : undefined}
        className={cn(
          showCarousel
            ? "no-scrollbar -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-3 pb-2 scroll-smooth"
            : "grid min-w-0 grid-cols-1 gap-5 [grid-auto-flow:dense] md:grid-cols-2 lg:grid-cols-12",
        )}
      >
        {activeList.map((id, pageIndex) => {
          const meta = WIDGETS[id];
          const hidden = layout.isHidden(id);
          const index = layout.order.indexOf(id);
          const isDragging = draggedId === id;
          const isDropTarget = dropIndicator?.id === id;

          const widgetBody =
            meta.pro && !isPro ? (
              <LockedWidget title={meta.label} feature={meta.label} />
            ) : (
              meta.render()
            );

          return (
            <div
              key={id}
              data-widget-card
              draggable={customizing}
              onDragStart={(e) => handleDragStart(e, id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, id)}
              onDragEnd={handleDragEnd}
              data-widget-slide={showCarousel ? true : undefined}
              role={showCarousel ? "group" : undefined}
              aria-label={
                showCarousel ? `${meta.label}, ${pageIndex + 1} of ${activeList.length}` : undefined
              }
              aria-roledescription={showCarousel ? "slide" : undefined}
              className={cn(
                showCarousel ? "h-[26rem] w-full shrink-0 snap-center" : colSpanClass(sizeOf(id)),
                "min-w-0 transition-all duration-200 relative group",
                customizing && "rounded-2xl ring-1 ring-foreground/15 hover:ring-foreground/30",
                isDragging && "opacity-40 scale-[0.98] ring-2 ring-primary shadow-2xl",
                hidden && "opacity-40",
                isDropTarget &&
                  dropIndicator.position === "before" &&
                  "before:absolute before:-top-3 before:left-0 before:right-0 before:h-1.5 before:rounded-full before:bg-primary before:shadow-status-live before:z-20",
                isDropTarget &&
                  dropIndicator.position === "after" &&
                  "after:absolute after:-bottom-3 after:left-0 after:right-0 after:h-1.5 after:rounded-full after:bg-primary after:shadow-status-live after:z-20",
              )}
            >
              {customizing && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 bg-foreground/[0.04] px-3.5 py-2.5 rounded-t-2xl">
                  {/* Grip & Title */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                      <GripVertical className="h-4 w-4 shrink-0" />
                    </span>
                    <span className="truncate text-xs font-semibold text-foreground">
                      {meta.label}
                    </span>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Size Selector */}
                    <div className="flex items-center rounded-lg border border-foreground/15 p-0.5 bg-background/50">
                      {SIZE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => layout.setSize(id, opt.value)}
                          title={`${meta.label} size ${opt.label} (${opt.desc})`}
                          aria-pressed={sizeOf(id) === opt.value}
                          className={cn(
                            "h-7 w-7 rounded-md text-[11px] font-semibold transition-colors",
                            sizeOf(id) === opt.value
                              ? "bg-foreground text-background shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Move Up */}
                    <button
                      type="button"
                      onClick={() => layout.move(id, -1)}
                      disabled={index === 0}
                      title={`Move ${meta.label} earlier`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/5 disabled:opacity-25"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      onClick={() => layout.move(id, 1)}
                      disabled={index === layout.order.length - 1}
                      title={`Move ${meta.label} later`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/5 disabled:opacity-25"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>

                    {/* Hide Toggle */}
                    <button
                      type="button"
                      onClick={() => layout.toggle(id)}
                      title={hidden ? `Show ${meta.label}` : `Hide ${meta.label}`}
                      aria-pressed={!hidden}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg border border-foreground/15 transition-colors",
                        hidden
                          ? "text-muted-foreground hover:text-foreground"
                          : "text-foreground hover:bg-foreground/5",
                      )}
                    >
                      {hidden ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Widget Content */}
              <div
                className={cn(
                  customizing && "p-1 pointer-events-none",
                  showCarousel &&
                    "no-scrollbar h-full overflow-y-auto overscroll-y-contain [&>*]:min-h-full",
                )}
              >
                {widgetBody}
              </div>
            </div>
          );
        })}
      </div>

      {showCarousel && activeList.length > 1 && (
        <div className="!mt-0.5 flex min-h-6 items-center justify-center" aria-label="Widget pages">
          {activeList.map((id, index) => (
            <button
              key={id}
              type="button"
              onClick={() => goToWidget(index)}
              aria-label={`Show ${WIDGETS[id].label}`}
              aria-current={activeWidget === index ? "page" : undefined}
              className="flex h-6 w-6 items-center justify-center rounded-full"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-all duration-200",
                  activeWidget === index ? "scale-110 bg-foreground" : "bg-foreground/25",
                )}
              />
            </button>
          ))}
        </div>
      )}

      {/* Hidden Widgets Restore Tray */}
      {customizing && hiddenWidgets.length > 0 && (
        <section className="glass-panel-strong mt-8 p-5">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Hidden Widgets ({hiddenWidgets.length})
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Click any widget below to add it back to your dashboard.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {hiddenWidgets.map((hid) => {
              const meta = WIDGETS[hid];
              return (
                <button
                  key={hid}
                  type="button"
                  onClick={() => layout.toggle(hid)}
                  className="glass-inset glass-hover inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-foreground transition"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
