import { Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mac-style traffic-light window controls used to toggle the sidebar.
 * Red = close (hide), Yellow = slim rail, Green = full width.
 */
export function TrafficLights({
  onRed,
  onYellow,
  onGreen,
  className,
}: {
  onRed?: () => void;
  onYellow?: () => void;
  onGreen?: () => void;
  className?: string;
}) {
  // Soft until the controls are hovered or focused, so three bright dots
  // don't sit at the top of every screen.
  const dot =
    "group/dot flex h-4 w-4 items-center justify-center rounded-full opacity-50 transition-[transform,opacity] duration-300 group-hover/lights:opacity-100 focus-visible:opacity-100 active:scale-90 [&_svg]:opacity-0 [&_svg]:transition-opacity hover:[&_svg]:opacity-100";
  const icon = "h-2.5 w-2.5 text-black/60";
  return (
    <div
      className={cn(
        "group/lights glass-inset flex items-center gap-1.5 rounded-full px-2 py-1.5 shadow-sm",
        className,
      )}
      role="group"
      aria-label="Sidebar controls"
    >
      <button
        type="button"
        onClick={onRed}
        aria-label="Close sidebar"
        title="Close sidebar"
        className={cn(dot, "bg-[#FF5F57] hover:bg-[#ff6f67]")}
      >
        <X className={icon} strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={onYellow}
        aria-label="Minimize sidebar"
        title="Slim sidebar"
        className={cn(dot, "bg-[#FEBC2E] hover:bg-[#ffcc4e]")}
      >
        <Minus className={icon} strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={onGreen}
        aria-label="Expand sidebar"
        title="Expand sidebar"
        className={cn(dot, "bg-[#28C840] hover:bg-[#3dd855]")}
      >
        <Plus className={icon} strokeWidth={3} />
      </button>
    </div>
  );
}
