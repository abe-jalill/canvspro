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
import { NO_CLASS_ID } from "@/lib/custom-assignments";
import { endOfAheadWindow } from "@/lib/assignment-window";

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
  onAdd: (input: NewCustomAssignment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");

  const add = (input: NewCustomAssignment) => {
    onAdd(input);
    setOpen(false);
    // To-Do lists the next four weeks; anything further out appears closer to the day.
    const shownNow = !input.due_at || Date.parse(input.due_at) <= endOfAheadWindow(Date.now());
    toast.success(shownNow ? "Added to To-Do" : "Added. It shows here closer to the due date.");
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
        className="press grid h-9 w-9 place-items-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
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
            className="mt-0"
          />
        ) : (
          <AddAssignmentForm
            courseId={NO_CLASS_ID}
            onAdd={add}
            onCancel={() => setStep("choose")}
            startOpen
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
