import { useId, useState } from "react";
import { Clock3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { assignmentsQueryOptions } from "@/lib/canvas.queries";
import { useAssignmentMeta, useSetAssignmentEstimate } from "@/hooks/use-assignment-meta";
import { customToAssignmentItem, useCustomAssignments } from "@/lib/custom-assignments";
import { defaultEstimateMinutes } from "@/lib/get-it-done";
import {
  formatEstimateMinutes,
  parseEstimateMinutes,
  MAX_ESTIMATE_MINUTES,
} from "@/lib/assignment-estimates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** One saved estimate, shared by every occurrence of this assignment. */
export function AssignmentEstimateEditor({
  assignment,
  className,
}: {
  assignment: AssignmentItem;
  className?: string;
}) {
  const meta = useAssignmentMeta();
  const mutation = useSetAssignmentEstimate();
  const minutes =
    meta.data?.find((row) => row.assignmentId === assignment.id)?.estimatedMinutes ??
    defaultEstimateMinutes(assignment);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(minutes));
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function save() {
    const value = parseEstimateMinutes(draft);
    if (value == null) {
      setError(`Enter a whole number from 1 to ${MAX_ESTIMATE_MINUTES}.`);
      return;
    }
    setError(null);
    try {
      await mutation.mutateAsync({
        assignmentId: assignment.id,
        courseId: assignment.course_id,
        minutes: value,
      });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save the estimate. Try again.");
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        if (mutation.isPending) return;
        setOpen(value);
        if (value) {
          setDraft(String(minutes));
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={meta.isLoading}
          aria-busy={meta.isLoading}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex min-h-9 max-w-full shrink-0 items-center gap-1.5 rounded-lg border border-foreground/15 bg-foreground/[0.03] px-2.5 text-xs tabular-nums text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:min-h-11",
            className,
          )}
          aria-label={`Edit estimated time for ${assignment.name}: ${minutes} minutes`}
          title="Edit estimated time"
        >
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{formatEstimateMinutes(minutes)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="w-72 max-w-[calc(100vw-1.5rem)] p-4"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!mutation.isPending) void save();
          }}
          className="space-y-3"
        >
          <div>
            <p className="text-sm font-medium">Estimated time</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{assignment.name}</p>
          </div>
          <label htmlFor={inputId} className="block space-y-1.5 text-xs text-muted-foreground">
            Minutes
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_ESTIMATE_MINUTES}
              step={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={mutation.isPending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
              className="mt-1.5 h-11 w-full rounded-xl border border-glass-border bg-background/50 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[15, 30, 45, 60, 90, 120].map((value) => (
              <button
                key={value}
                type="button"
                disabled={mutation.isPending}
                onClick={() => setDraft(String(value))}
                aria-pressed={Number(draft) === value}
                className="min-h-9 rounded-lg border border-foreground/10 px-2 text-xs text-muted-foreground hover:bg-foreground/[0.06] aria-pressed:border-foreground/40 aria-pressed:bg-foreground/10 aria-pressed:text-foreground"
              >
                {formatEstimateMinutes(value)}
              </button>
            ))}
          </div>
          {error && (
            <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
              className="min-h-10 rounded-xl px-3 text-xs text-muted-foreground hover:bg-foreground/[0.06]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || meta.isLoading}
              className="min-h-10 rounded-xl bg-foreground px-4 text-xs font-medium text-background disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Calendar picks and stored sessions keep an id instead of the full assignment. */
export function CachedAssignmentEstimate({
  assignmentId,
  className,
}: {
  assignmentId: number;
  className?: string;
}) {
  const query = useQuery({ ...assignmentsQueryOptions, enabled: false });
  const custom = useCustomAssignments();
  const manual = custom.list.find((item) => item.id === assignmentId);
  const assignment =
    query.data?.find((item) => item.id === assignmentId) ??
    (manual ? customToAssignmentItem(manual, undefined) : null);
  return assignment ? (
    <AssignmentEstimateEditor assignment={assignment} className={className} />
  ) : null;
}
