/**
 * Steps for big work: an assignment broken into small, near pieces
 * ("Outline", "Draft"). Ticking steps fills the assignment's progress, and
 * To-Do shows the next one. Saved to the account under this key; the iPhone
 * app reads and writes the same record.
 */
export const ASSIGNMENT_STEPS_KEY = "assignment-steps";

export interface AssignmentStep {
  id: string;
  title: string;
  /** Rough minutes for this step, or null. */
  minutes: number | null;
  done: boolean;
}

/** Assignment id → its steps, in order. */
export type StepsByAssignment = Record<string, AssignmentStep[]>;

export function readSteps(value: unknown): StepsByAssignment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: StepsByAssignment = {};
  for (const [id, list] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const steps = list
      .filter(
        (s): s is AssignmentStep =>
          !!s && typeof s === "object" && typeof (s as AssignmentStep).title === "string",
      )
      .map((s, i) => ({
        id: typeof s.id === "string" ? s.id : `s${i}`,
        title: s.title,
        minutes: typeof s.minutes === "number" && s.minutes > 0 ? Math.round(s.minutes) : null,
        done: s.done === true,
      }));
    if (steps.length > 0) out[id] = steps;
  }
  return out;
}

export function newStepId(): string {
  return `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** The first step not done yet. */
export function nextStep(steps: AssignmentStep[] | undefined): AssignmentStep | null {
  return steps?.find((s) => !s.done) ?? null;
}

/** Percent done, weighted by each step's minutes when every step has them. */
export function stepsPercent(steps: AssignmentStep[]): number {
  if (steps.length === 0) return 0;
  const timed = steps.every((s) => s.minutes != null);
  const weight = (s: AssignmentStep) => (timed ? (s.minutes as number) : 1);
  const total = steps.reduce((sum, s) => sum + weight(s), 0);
  const done = steps.filter((s) => s.done).reduce((sum, s) => sum + weight(s), 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** Worth breaking down: a lot of points or a long estimate. */
export function isBigWork(points: number | null | undefined, estimateMinutes: number): boolean {
  return (points ?? 0) >= 50 || estimateMinutes >= 90;
}

/** Suggested steps from the kind of work its name suggests, with the estimate shared out. */
export function suggestSteps(name: string, estimateMinutes: number): AssignmentStep[] {
  const n = name.toLowerCase();
  const plan: [string, number][] = /exam|midterm|final|quiz|test/.test(n)
    ? [
        ["Gather notes and topics", 0.15],
        ["Review the main ideas", 0.35],
        ["Practice problems", 0.35],
        ["Quick self-test", 0.15],
      ]
    : /lab/.test(n)
      ? [
          ["Read the lab and pre-lab", 0.2],
          ["Do the work and collect data", 0.4],
          ["Write it up", 0.3],
          ["Check and submit", 0.1],
        ]
      : /project|presentation|portfolio/.test(n)
        ? [
            ["Plan what's needed", 0.15],
            ["Build the main part", 0.5],
            ["Polish", 0.25],
            ["Check and submit", 0.1],
          ]
        : /essay|paper|report|writing|draft|response|reflection|review/.test(n)
          ? [
              ["Research and notes", 0.25],
              ["Outline", 0.15],
              ["Write the draft", 0.4],
              ["Revise and submit", 0.2],
            ]
          : [
              ["Read what's asked", 0.1],
              ["Do the main part", 0.6],
              ["Check your work", 0.2],
              ["Submit", 0.1],
            ];
  return plan.map(([title, share], i) => ({
    id: `${newStepId()}-${i}`,
    title,
    minutes: Math.max(5, Math.round((estimateMinutes * share) / 5) * 5),
    done: false,
  }));
}
