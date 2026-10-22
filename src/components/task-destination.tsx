import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { NO_CLASS_ID, useCustomAssignments } from "@/lib/custom-assignments";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatMinutes } from "@/lib/format-minutes";

/** Personal task details stay on the surface that opened them. */
export function TaskDestination({ assignment: a, children, className }: {
  assignment: AssignmentItem; children: ReactNode; className?: string;
}) {
  if (a.course_id === NO_CLASS_ID) {
    return <PersonalTaskDetails assignment={a} className={className}>{children}</PersonalTaskDetails>;
  }
  return <Link {...(a.id < 0
    ? { to: "/assignments", search: { assignment: String(a.id) } }
    : { to: "/courses/$courseId", params: { courseId: String(a.course_id) }, search: { assignment: String(a.id) } })}
    preload="intent" className={className}>{children}</Link>;
}

function PersonalTaskDetails({ assignment, children, className }: {
  assignment: AssignmentItem; children: ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const custom = useCustomAssignments(true);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className={`text-left ${className ?? ""}`}>{children}</button>
      <DialogContent className="glass-panel-strong rounded-2xl">
        <DialogHeader>
          <DialogTitle>{assignment.name}</DialogTitle>
          <DialogDescription>Personal task</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {assignment.due_at ? `Due ${new Date(assignment.due_at).toLocaleString()}` : "No due date"}
        </p>
        {assignment.estimated_minutes != null && <p className="text-sm text-muted-foreground">{formatMinutes(assignment.estimated_minutes)}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!completed.ready} className="glass-hover min-h-11 rounded-xl border border-glass-border px-4 text-sm"
            onClick={() => { completed.toggle(assignment.id); setOpen(false); }}>
            {completed.has(assignment.id) ? "Mark incomplete" : "Mark complete"}
          </button>
          <button type="button" className="min-h-11 rounded-xl px-4 text-sm text-destructive"
            onClick={() => { custom.remove(assignment.id); setOpen(false); }}>Delete task</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
