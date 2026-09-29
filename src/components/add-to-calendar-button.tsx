import { CalendarCheck, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { useCalendarPicks } from "@/lib/calendar-picks";

export function AddToCalendarButton({
  assignment,
  className,
  iconClassName = "h-4 w-4",
}: {
  assignment: AssignmentItem;
  className: string;
  iconClassName?: string;
}) {
  const { ids, add, remove } = useCalendarPicks();
  const added = ids.has(assignment.id);
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (added) {
      remove(assignment.id);
      toast("Removed from your Calendar");
    } else {
      add(assignment);
      toast.success("Added to your Calendar at 12:00 PM", {
        description: "You can change the time on the Calendar page.",
      });
    }
  };
  const Icon = added ? CalendarCheck : CalendarPlus;
  return (
    <button
      onClick={onClick}
      aria-pressed={added}
      aria-label={added ? `Remove ${assignment.name} from calendar` : `Add ${assignment.name} to calendar`}
      title={added ? "On your Calendar (tap to remove)" : "Add to calendar"}
      className={`${className} ${added ? "text-foreground" : ""}`}
    >
      <Icon className={iconClassName} />
    </button>
  );
}
