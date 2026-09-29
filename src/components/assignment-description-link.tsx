import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function AssignmentDescriptionLink({
  assignmentId,
  className,
}: {
  assignmentId: number;
  className?: string;
}) {
  return (
    <Link
      to="/assignments"
      search={{ assignment: String(assignmentId) }}
      preload="intent"
      className={cn(
        "inline-flex text-[11px] font-medium text-muted-foreground underline decoration-foreground/20 underline-offset-2 transition-colors hover:text-foreground",
        className,
      )}
    >
      See description
    </Link>
  );
}
