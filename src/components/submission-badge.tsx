import { cn } from "@/lib/utils";
import type { AssignmentItem } from "@/lib/canvas.functions";

/**
 * Compact submission-status pill pulled from Canvas.
 * Renders nothing for plain "not submitted" work so lists stay calm.
 */
export function SubmissionBadge({ assignment }: { assignment: AssignmentItem }) {
  const s = assignment.submission;
  if (s?.missing) {
    return <Badge tone="red">Missing</Badge>;
  }
  if (s?.workflow_state === "graded" || s?.score != null) {
    return <Badge tone="green">Graded</Badge>;
  }
  if (s?.submitted_at) {
    return <Badge tone="blue">Submitted</Badge>;
  }
  return null;
}

function Badge({
  tone,
  children,
}: {
  tone: "red" | "green" | "blue";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4",
        tone === "red" && "border-red-400/20 bg-red-400/10 text-red-400",
        tone === "green" && "border-emerald-400/20 bg-emerald-400/10 text-emerald-400",
        tone === "blue" && "border-blue-400/20 bg-blue-400/10 text-blue-400",
      )}
    >
      {children}
    </span>
  );
}
