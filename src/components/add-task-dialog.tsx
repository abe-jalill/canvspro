import { useState } from "react";
import { BookOpen, ChevronRight, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddAssignmentForm, type NewCustomAssignment } from "@/components/add-assignment-form";
import {
  customToAssignmentItem,
  NO_CLASS_ID,
  type CustomAssignment,
} from "@/lib/custom-assignments";
import { useCalendarPicks } from "@/lib/calendar-picks";

type Step = "choose" | "class" | "personal";

/**
 * To-Do's Add: first whether it's for a class. For a class it's the same
 * form as Assignments (with the class to pick); otherwise only a name, when
 * it's due and how long it takes.
 */
export function AddTaskButton({
  courseOptions,
  onAdd,
}: {
  courseOptions: { id: number; label: string }[];
  onAdd: (input: NewCustomAssignment) => CustomAssignment | Promise<CustomAssignment>;
}) {
  const picks = useCalendarPicks();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");

  const add = async (input: NewCustomAssignment, calendarAt?: string) => {
    const item = await onAdd(input);
    const label = courseOptions.find((c) => c.id === item.course_id)?.label;
    if (calendarAt && input.course_id !== NO_CLASS_ID)
      picks.add(customToAssignmentItem(item, label ? { name: label, course_code: "" } : undefined), calendarAt);
    setOpen(false);
    toast.success(calendarAt && input.course_id !== NO_CLASS_ID ? "Added to To-Do and your calendar" : input.course_id === NO_CLASS_ID ? "Task added" : "Assignment added", {
      description: input.due_at ? 'Due ' + new Date(input.due_at).toLocaleString() + '. Choose that day in To-Do to see it.' : undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setStep("choose");
      }}
    >
      <button
        type="button"
        onClick={() => {
          setStep("choose");
          setOpen(true);
        }}
        aria-label="Add a task"
        className="press inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/15 px-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add
      </button>
      <DialogContent className="glass-panel-strong max-h-[90dvh] overflow-y-auto rounded-2xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "class" ? "New assignment" : step === "personal" ? "New task" : "Add a task"}
          </DialogTitle>
          <DialogDescription>
            {step === "choose"
              ? "Is this for a class?"
              : step === "class"
                ? "Only you see this. It's listed with your Canvas work."
                : "Only you see this. It isn't filed under a class."}
          </DialogDescription>
        </DialogHeader>

        {step === "choose" ? (
          <div className="grid gap-2">
            <ChoiceButton
              icon={<BookOpen className="h-4 w-4" />}
              title="For a class"
              detail={
                courseOptions.length > 0
                  ? "An assignment, quiz or project for one of your classes."
                  : "Connect Canvas to add work for a class."
              }
              disabled={courseOptions.length === 0}
              onClick={() => setStep("class")}
            />
            <ChoiceButton
              icon={<ListChecks className="h-4 w-4" />}
              title="Not for a class"
              detail="Anything else you need to get done."
              onClick={() => setStep("personal")}
            />
          </div>
        ) : step === "class" ? (
          <AddAssignmentForm
            courseOptions={courseOptions}
            onAdd={add}
            onCancel={() => setStep("choose")}
            startOpen
            calendarOption
            className="mt-0"
          />
        ) : (
          <AddAssignmentForm
            courseId={NO_CLASS_ID}
            onAdd={add}
            onCancel={() => setStep("choose")}
            startOpen
            calendarOption
            className="mt-0"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChoiceButton({
  icon,
  title,
  detail,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="glass-hover flex min-h-14 w-full items-center gap-3 rounded-xl border border-foreground/10 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground/10 text-foreground/80">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
