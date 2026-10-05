import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { assignmentsQueryOptions } from "@/lib/canvas.queries";
import { cn } from "@/lib/utils";
import { AssignmentProgressBar } from "@/components/assignment-progress";

const linkClass =
  "inline-flex text-[11px] font-medium text-muted-foreground underline decoration-foreground/20 underline-offset-2 transition-colors hover:text-foreground";

/**
 * Opens the assignment's description on its class page: the class page scrolls
 * to the assignment, opens the description and briefly highlights it.
 * The course is looked up from the cached assignments (no extra request), so
 * callers only need the assignment id.
 */
export function AssignmentDescriptionLink({
  assignmentId,
  className,
  showProgress = true,
}: {
  assignmentId: number;
  className?: string;
  showProgress?: boolean;
}) {
  const link = <DescriptionLink assignmentId={assignmentId} className={className} />;
  if (!showProgress) return link;
  return (
    <>
      <AssignmentProgressBar assignmentId={assignmentId} className="mt-1" />
      {link}
    </>
  );
}

function DescriptionLink({ assignmentId, className }: { assignmentId: number; className?: string }) {
  const { data: courseId } = useQuery({
    ...assignmentsQueryOptions,
    enabled: false,
    select: (items) => items.find((item) => item.id === assignmentId)?.course_id,
  });

  if (courseId == null) {
    // Assignments not loaded yet: keep the old destination rather than a dead link.
    return (
      <Link
        to="/assignments"
        search={{ assignment: String(assignmentId) }}
        preload="intent"
        className={cn(linkClass, className)}
      >
        See description
      </Link>
    );
  }

  return (
    <Link
      to="/courses/$courseId"
      params={{ courseId: String(courseId) }}
      search={{ assignment: String(assignmentId) }}
      preload="intent"
      className={cn(linkClass, className)}
    >
      See description
    </Link>
  );
}
