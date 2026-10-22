import { useState } from "react";
import { Check, Plus, Sparkles, X } from "lucide-react";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { suggestSteps, stepsPercent } from "@/lib/assignment-steps";
import { formatMinutes } from "@/lib/format-minutes";
import { cn } from "@/lib/utils";
import type { useAssignmentSteps } from "@/hooks/use-assignment-steps";

/**
 * A big assignment's steps, under its To-Do row: tick them off, add your own,
 * or start from a suggested set. Ticking fills the assignment's progress.
 */
export function StepList({
  assignment,
  estimate,
  steps: api,
  color,
}: {
  assignment: AssignmentItem;
  estimate: number;
  steps: ReturnType<typeof useAssignmentSteps>;
  color: string;
}) {
  const steps = api.stepsFor(assignment.id);
  const [draft, setDraft] = useState("");
  const percent = stepsPercent(steps);

  return (
    <div className="mt-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
      {steps.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Break it into small steps so it's easier to start.
          </p>
          <button
            type="button"
            onClick={() => api.save(assignment, suggestSteps(assignment.name, estimate))}
            disabled={!api.ready}
            className="press inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-foreground/15 px-3 text-xs font-medium hover:border-foreground/30 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Suggest steps
          </button>
        </div>
      ) : (
        <>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Steps · {percent}% done
          </p>
          <ul className="space-y-0.5">
            {steps.map((step) => (
              <li key={step.id} className="group/step flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => api.toggle(assignment, step.id)}
                  aria-label={`${step.title}: mark ${step.done ? "not done" : "done"}`}
                  aria-pressed={step.done}
                  className="relative grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors after:absolute after:-inset-3 after:content-['']"
                  style={{
                    borderColor: color,
                    backgroundColor: step.done ? color : "transparent",
                  }}
                >
                  <Check
                    className={cn("h-2.5 w-2.5 text-background", !step.done && "opacity-0")}
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 py-1.5 text-sm",
                    step.done && "text-muted-foreground line-through",
                  )}
                >
                  {step.title}
                  {step.minutes != null && (
                    <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                      {formatMinutes(step.minutes)}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => api.remove(assignment, step.id)}
                  aria-label={`Remove step ${step.title}`}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground opacity-60 hover:bg-foreground/5 hover:text-foreground group-hover/step:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const title = draft.trim();
          if (!title) return;
          api.add(assignment, title);
          setDraft("");
        }}
      >
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a step"
          aria-label={`Add a step to ${assignment.name}`}
          className="min-h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </form>
    </div>
  );
}
