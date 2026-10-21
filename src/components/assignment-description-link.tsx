import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { assignmentsQueryOptions } from "@/lib/canvas.queries";
import { notYetOpen, opensLabel } from "@/lib/assignment-availability";
import { cn } from "@/lib/utils";
import { AssignmentProgressBar } from "@/components/assignment-progress";

// Its own line, so it never runs into a time chip or another link beside it.
const linkClass =
  "flex w-fit text-[11px] font-medium text-muted-foreground underline decoration-foreground/20 underline-offset-2 transition-colors hover:text-foreground";

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
  const opens = <CachedOpensLabel assignmentId={assignmentId} />;
  if (!showProgress) {
    return (
      <>
        {opens}
        {link}
      </>
    );
  }
  return (
    <>
      {opens}
      <AssignmentProgressBar assignmentId={assignmentId} className="mt-1" />
      {link}
    </>
  );
}

/** "Opens Tue, Oct 20 at 9:00 AM" while Canvas hasn't opened the assignment yet; nothing after. */
export function OpensLabel({
  unlockAt,
  className,
}: {
  unlockAt?: string | null;
  className?: string;
}) {
  if (!unlockAt || !notYetOpen({ unlock_at: unlockAt })) return null;
  return (
    <p
      className={cn(
        "mt-0.5 flex items-center gap-1 text-[11px] font-medium text-foreground/80",
        className,
      )}
    >
      <LockKeyhole className="h-3 w-3 shrink-0" aria-hidden="true" />
      {opensLabel(unlockAt)}
    </p>
  );
}

function CachedOpensLabel({ assignmentId }: { assignmentId: number }) {
  const { data: unlockAt } = useQuery({
    ...assignmentsQueryOptions,
    enabled: false,
    select: (items) => items.find((item) => item.id === assignmentId)?.unlock_at ?? null,
  });
  return <OpensLabel unlockAt={unlockAt} />;
}

function DescriptionLink({
  assignmentId,
  className,
}: {
  assignmentId: number;
  className?: string;
}) {
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
