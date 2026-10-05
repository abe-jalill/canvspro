import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAssignmentProgress, useSetAssignmentProgress } from "@/hooks/use-assignment-meta";

/** Read-only bar shown anywhere an assignment appears, once progress is set. */
export function AssignmentProgressBar({
  assignmentId,
  className,
}: {
  assignmentId: number;
  className?: string;
}) {
  const percent = useAssignmentProgress(assignmentId);
  if (percent == null || percent <= 0) return null;
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Percent complete"
    >
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{percent}%</span>
    </div>
  );
}

/** Editable slider used on the Assignments page. */
export function AssignmentProgressEditor({
  assignmentId,
  courseId,
}: {
  assignmentId: number;
  courseId: number;
}) {
  const saved = useAssignmentProgress(assignmentId) ?? 0;
  const [draft, setDraft] = useState(saved);
  const { mutate } = useSetAssignmentProgress();
  useEffect(() => setDraft(saved), [saved]);

  function commit(value: number) {
    if (value === saved) return;
    mutate({ assignmentId, courseId, percent: value === 0 ? null : value });
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={draft}
        aria-label="Percent complete"
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onBlur={(e) => commit(Number(e.target.value))}
        className="h-1.5 w-28 cursor-pointer accent-foreground"
      />
      <span className="w-9 text-[11px] tabular-nums text-muted-foreground">{draft}%</span>
    </div>
  );
}
