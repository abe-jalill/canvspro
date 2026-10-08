import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";
import { ErrorState, GlassCard, Skeleton } from "@/components/glass-card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  studyPhaseFeedback,
  studySelectionFeedback,
  studySuccessFeedback,
} from "@/lib/study-session-feedback";
import { useStudySession } from "@/hooks/use-study-session";
import { useAssignmentMetaMap } from "@/hooks/use-assignment-meta";
import {
  compareByDueDate,
  isAssignmentComplete,
  isAssignmentVisible,
} from "@/lib/assignment-window";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { isInStudySessionWindow } from "@/lib/study-session-window";
import { defaultEstimateMinutes } from "@/lib/get-it-done";
import {
  POMODORO_LIMITS,
  POMODORO_PRESETS,
  advanceSession,
  buildPomodoroPlan,
  createStudySession,
  focusItem,
  isBreak,
  itemMinutes,
  nextItemSession,
  phaseOf,
  remainingForSession,
  skipBreak,
  totalItemMinutes,
  type PomodoroPresetId,
  type StudySessionItem,
  type StudySessionSnapshot,
} from "@/lib/study-session";

import { assignmentsQueryOptions as assignmentsQO } from "@/lib/canvas.queries";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";

const PRESETS = [15, 25, 45, 60, 90];
const TIME_MODE_KEY = "canvas:study-time-mode";
const POMODORO_PREF_KEY = "canvas:study-pomodoro";
const POMODORO_PRESET_KEY = "canvas:study-pomodoro-preset";
const POMODORO_CUSTOM_KEY = "canvas:study-pomodoro-custom";

type TimeMode = "total" | "per" | "pomodoro";
type PomodoroChoice = PomodoroPresetId | "custom";
type CustomField = "focus" | "shortBreak" | "longBreak" | "rounds";

const TIME_MODES: { id: TimeMode; label: string }[] = [
  { id: "total", label: "Total time" },
  { id: "per", label: "Per assignment" },
  { id: "pomodoro", label: "Pomodoro" },
];

const CUSTOM_FIELDS: { key: CustomField; label: string; unit: string }[] = [
  { key: "focus", label: "Focus", unit: "min" },
  { key: "shortBreak", label: "Short break", unit: "min" },
  { key: "longBreak", label: "Long break", unit: "min" },
  { key: "rounds", label: "Long break every", unit: "blocks" },
];

const CUSTOM_DEFAULTS: Record<CustomField, string> = Object.fromEntries(
  CUSTOM_FIELDS.map(({ key }) => [key, String(POMODORO_LIMITS[key].fallback)]),
) as Record<CustomField, string>;

const pillButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:border disabled:border-foreground/15 disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100 disabled:hover:opacity-100";
const roundIconButton =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-30";
const textButton = "text-sm text-muted-foreground transition-colors hover:text-foreground";
const choiceButton = (selected: boolean) =>
  cn(
    "min-h-10 rounded-lg border px-3 text-sm transition-colors",
    selected
      ? "border-foreground/60 text-foreground"
      : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
  );

export const Route = createFileRoute("/_authenticated/study-session")({
  validateSearch: (search: Record<string, unknown>): { assignment?: number; picks?: string } => {
    const assignment = Number(search.assignment);
    // `picks` preselects several assignments at once, e.g. ?picks=12,34,56.
    const picks =
      typeof search.picks === "string" || typeof search.picks === "number"
        ? String(search.picks)
            .split(",")
            .map(Number)
            .filter((id) => Number.isFinite(id) && id > 0)
            .join(",")
        : "";
    return {
      assignment: Number.isFinite(assignment) && assignment > 0 ? assignment : undefined,
      ...(picks ? { picks } : {}),
    };
  },
  head: () => ({ meta: [{ title: "Study Session — CanvasPro" }] }),
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(assignmentsQO);
    }
  },
  component: StudySessionPage,
});

function canvasItem(assignment: AssignmentItem): StudySessionItem {
  return {
    id: `canvas:${assignment.id}`,
    name: assignment.name,
    source: "canvas",
    courseName: displayCourseName(assignment.course_name, assignment.course_code),
    dueAt: assignment.due_at,
  };
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function nextUnfinished(session: StudySessionSnapshot, from: number) {
  for (let offset = 1; offset <= session.items.length; offset += 1) {
    const index = (from + offset) % session.items.length;
    if (!session.completedItemIds.includes(session.items[index].id)) return index;
  }
  return from;
}

function StudyClock({
  remaining,
  total,
  label,
}: {
  remaining: number;
  total: number;
  label: string;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const elapsed = total <= 0 ? 0 : Math.min(1, Math.max(0, (total - remaining) / total));

  return (
    <div className="study-clock" aria-label={`${formatTime(remaining)} remaining`}>
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle className="study-clock__track" cx="64" cy="64" r={radius} />
        <circle
          className="study-clock__progress"
          cx="64"
          cy="64"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - elapsed)}
        />
      </svg>
      <div className="study-clock__time">
        <span>{formatTime(remaining)}</span>
        <small>{label}</small>
      </div>
    </div>
  );
}

/** The whole session as a ring: one arc per task, sized by its share of the time. */
function SessionRing({
  segments,
  value,
  label,
}: {
  segments: number[];
  value: string;
  label: string;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, minutes) => sum + minutes, 0);
  const gap = segments.length > 1 ? 4 : 0;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-3" role="img" aria-label={`${label}: ${value}`}>
      <svg viewBox="0 0 128 128" className="h-52 w-52 -rotate-90" aria-hidden="true">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="5"
          className="stroke-foreground/10"
        />
        {total > 0 &&
          segments.map((minutes, index) => {
            const length = (minutes / total) * circumference;
            const arc = (
              <circle
                key={index}
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                className="stroke-foreground transition-all duration-500"
                style={{ opacity: 0.85 - (index % 3) * 0.22 }}
                strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return arc;
          })}
      </svg>
      {/* Below the ring, not inside it: long plans ("27 min focus, 8 min break") don't fit inside. */}
      <div className="flex flex-col items-center text-center">
        <span className="text-sm font-medium tracking-tight tabular-nums">{value}</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

/** Step number and title at the top of a section inside a card. */
function StepHeading({
  step,
  title,
  trailing,
}: {
  step: number;
  title: string;
  trailing?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-foreground/25 text-[11px] tabular-nums text-muted-foreground">
        {step}
      </span>
      <h2 className="flex-1 text-base font-normal tracking-tight">{title}</h2>
      {trailing && <span className="text-xs tabular-nums text-muted-foreground">{trailing}</span>}
    </div>
  );
}

function MinutesField({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (minutes: number) => void;
  label: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={480}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(Number(event.target.value))}
        onBlur={() => onChange(Math.min(480, Math.max(1, Math.round(value) || 25)))}
        className="h-9 w-16 text-center text-sm tabular-nums"
        aria-label={label}
      />
      <span className="text-xs text-muted-foreground">min</span>
    </span>
  );
}

function StudySessionPage() {
  const { assignment: requestedAssignment, picks: requestedPicks } = Route.useSearch();
  const assignments = useQuery(assignmentsQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const metaMap = useAssignmentMetaMap();
  const { session, setSession, ready } = useStudySession();
  const [selected, setSelected] = useState<StudySessionItem[]>([]);
  const [minutesById, setMinutesById] = useState<Record<string, number>>({});
  const [manualName, setManualName] = useState("");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [duration, setDuration] = useState(25);
  const [timeMode, setTimeMode] = useState<TimeMode>("total");
  const [presetId, setPresetId] = useState<PomodoroChoice>("classic");
  // Kept as text while typing so a field can be empty for a moment.
  const [custom, setCustom] = useState<Record<CustomField, string>>(CUSTOM_DEFAULTS);
  const [now, setNow] = useState(() => Date.now());
  const [summary, setSummary] = useState<StudySessionSnapshot | null>(null);
  const selectedFromLink = useRef<string | null>(null);

  useEffect(() => {
    const ids = [
      ...(requestedAssignment ? [requestedAssignment] : []),
      ...(requestedPicks ? requestedPicks.split(",").map(Number) : []),
    ];
    const key = ids.join(",");
    if (!ids.length || selectedFromLink.current === key || !assignments.data) return;
    const found = ids
      .map((id) => assignments.data?.find((item) => item.id === id))
      .filter((item): item is AssignmentItem => Boolean(item))
      .map(canvasItem);
    if (!found.length) return;
    setSelected((items) => [
      ...found.filter((next) => !items.some((item) => item.id === next.id)),
      ...items,
    ]);
    selectedFromLink.current = key;
  }, [assignments.data, requestedAssignment, requestedPicks]);

  // The last time choice is remembered. Before this page had modes, Pomodoro
  // was a switch; someone who left it on keeps Pomodoro.
  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(TIME_MODE_KEY);
      if (savedMode === "total" || savedMode === "per" || savedMode === "pomodoro") {
        setTimeMode(savedMode);
      } else if (window.localStorage.getItem(POMODORO_PREF_KEY) === "on") {
        setTimeMode("pomodoro");
      }
      const saved = window.localStorage.getItem(POMODORO_PRESET_KEY);
      if (saved === "custom" || POMODORO_PRESETS.some((preset) => preset.id === saved)) {
        setPresetId(saved as PomodoroChoice);
      }
      const savedCustom = JSON.parse(window.localStorage.getItem(POMODORO_CUSTOM_KEY) ?? "null");
      if (savedCustom && typeof savedCustom === "object") {
        setCustom(
          Object.fromEntries(
            CUSTOM_FIELDS.map(({ key }) => [key, String(savedCustom[key] ?? CUSTOM_DEFAULTS[key])]),
          ) as Record<CustomField, string>,
        );
      }
    } catch {
      /* the defaults are fine */
    }
  }, []);

  function remember(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  function changeTimeMode(mode: TimeMode) {
    setTimeMode(mode);
    remember(TIME_MODE_KEY, mode);
    void studySelectionFeedback();
  }

  function changePreset(id: PomodoroChoice) {
    setPresetId(id);
    remember(POMODORO_PRESET_KEY, id);
  }

  function changeCustom(key: CustomField, value: string) {
    const next = { ...custom, [key]: value };
    setCustom(next);
    remember(POMODORO_CUSTOM_KEY, JSON.stringify(next));
  }

  /** The plan for the choice on screen; custom fields are clamped to safe values. */
  const chosenPlan =
    presetId === "custom"
      ? buildPomodoroPlan(custom)
      : (POMODORO_PRESETS.find((preset) => preset.id === presetId) ?? POMODORO_PRESETS[0]).plan;

  const assignmentById = useMemo(
    () => new Map((assignments.data ?? []).map((item) => [`canvas:${item.id}`, item])),
    [assignments.data],
  );

  /** Saved estimate, then a size-based guess for Canvas work, then 25 minutes. */
  function suggestedMinutes(item: StudySessionItem) {
    const assignment = assignmentById.get(item.id);
    if (!assignment) return 25;
    return metaMap.get(assignment.id)?.estimatedMinutes ?? defaultEstimateMinutes(assignment);
  }

  function minutesFor(item: StudySessionItem) {
    return minutesById[item.id] ?? suggestedMinutes(item);
  }

  useEffect(() => {
    if (!session || session.status !== "running") return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== "running" || remainingForSession(session, now) > 0) return;
    if (session.pomodoro) {
      // A pomodoro keeps going: focus flows into a break and back again.
      const result = advanceSession(session, now);
      if (!result.changed) return;
      setSession(result.session);
      void studyPhaseFeedback();
      toast(isBreak(result.session) ? "Time for a break" : "Back to focus", {
        description: isBreak(result.session)
          ? `${formatTime(result.session.durationMs)} to rest.`
          : "Your next focus block has started.",
      });
      return;
    }
    if (session.perItem) {
      // Each assignment has its own time; when it runs out, the next one starts.
      const next = nextItemSession(session, now);
      if (next) {
        setSession(next);
        void studyPhaseFeedback();
        toast(`Next: ${next.items[next.currentIndex].name}`, {
          description: `${itemMinutes(next.items[next.currentIndex])} min`,
        });
        return;
      }
    }
    setSummary(session);
    setSession(null);
    void studySuccessFeedback();
    toast.success("Study session complete");
  }, [now, session, setSession]);

  const { candidates, hiddenCount } = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    const visible = (assignments.data ?? [])
      .filter((item) =>
        needle
          ? showCompleted || !isAssignmentComplete(item, completed.has(item.id))
          : isAssignmentVisible(item, completed.has(item.id), showCompleted, now),
      )
      .sort(compareByDueDate);
    if (needle) {
      const candidates = visible.filter(
        (item) =>
          isInStudySessionWindow(item.due_at, now, true) &&
          `${item.name} ${item.course_name} ${item.course_code}`.toLowerCase().includes(needle),
      );
      return { candidates, hiddenCount: 0 };
    }
    const candidates = visible.filter((item) => isInStudySessionWindow(item.due_at, now, false));
    const searchable = visible.filter((item) => isInStudySessionWindow(item.due_at, now, true));
    return { candidates, hiddenCount: searchable.length - candidates.length };
  }, [assignments.data, completed, search, showCompleted]);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);

  function toggleItem(item: StudySessionItem) {
    setSelected((items) =>
      items.some((candidate) => candidate.id === item.id)
        ? items.filter((candidate) => candidate.id !== item.id)
        : [...items, item],
    );
    void studySelectionFeedback();
  }

  function move(index: number, direction: -1 | 1) {
    setSelected((items) => {
      const next = [...items];
      const target = index + direction;
      if (target < 0 || target >= next.length) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addManual() {
    const name = manualName.trim();
    if (!name) return;
    setSelected((items) => [
      ...items,
      {
        id: `manual:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        source: "manual",
      },
    ]);
    setManualName("");
    void studySelectionFeedback();
  }

  const plannedItems = selected.map((item) => ({
    ...item,
    minutes: itemMinutes({ ...item, minutes: minutesFor(item) }),
  }));
  const perItemTotal = totalItemMinutes(plannedItems);
  const durationValid = Number.isFinite(duration) && duration >= 1;
  const canStart = selected.length > 0 && (timeMode !== "total" || durationValid);

  const plan =
    timeMode === "pomodoro"
      ? `${chosenPlan.focusMs / 60_000} min focus, ${chosenPlan.shortBreakMs / 60_000} min break`
      : timeMode === "per"
        ? formatMinutes(perItemTotal)
        : durationValid
          ? formatMinutes(Math.min(480, Math.round(duration)))
          : "Choose a time";

  function start() {
    if (!canStart) return;
    const boundedDuration = Math.min(480, Math.max(1, Math.round(duration || 25)));
    setDuration(boundedDuration);
    setSummary(null);
    setSession(
      timeMode === "per"
        ? createStudySession(plannedItems, boundedDuration, Date.now(), undefined, true)
        : createStudySession(
            selected,
            boundedDuration,
            Date.now(),
            timeMode === "pomodoro" ? chosenPlan : undefined,
          ),
    );
    setNow(Date.now());
    void studySuccessFeedback();
  }

  if (!ready) {
    return <Skeleton className="mx-auto mt-16 h-48 max-w-2xl" />;
  }

  if (session) {
    const remaining = remainingForSession(session, now);
    const current = session.items[Math.min(session.currentIndex, session.items.length - 1)];
    const completed = new Set(session.completedItemIds);

    const update = (patch: Partial<StudySessionSnapshot>) => setSession({ ...session, ...patch });
    const goTo = (index: number) => {
      setSession(focusItem(session, index, Date.now()));
      setNow(Date.now());
    };
    const pauseOrResume = () => {
      if (session.status === "running") {
        update({ status: "paused", remainingMs: remaining });
      } else {
        update({ status: "running", endsAt: Date.now() + session.remainingMs });
        setNow(Date.now());
      }
      void studySelectionFeedback();
    };
    const finishItem = () => {
      if (completed.has(current.id)) return;
      const completedItemIds = [...session.completedItemIds, current.id];
      if (completedItemIds.length === session.items.length) {
        const final = { ...session, completedItemIds };
        setSummary(final);
        setSession(null);
        void studySuccessFeedback();
        return;
      }
      const withDone = { ...session, completedItemIds };
      setSession(focusItem(withDone, nextUnfinished(withDone, session.currentIndex), Date.now()));
      setNow(Date.now());
      void studySuccessFeedback();
    };

    const plan = session.pomodoro;
    const phase = phaseOf(session);
    const onBreak = isBreak(session);
    const rounds = plan?.roundsBeforeLongBreak ?? 0;
    // Focus blocks finished in the current cycle (a long break closes a full cycle).
    const cycleDone = plan ? (phase === "long-break" ? rounds : (session.round ?? 0) % rounds) : 0;
    const clockLabel =
      session.status === "paused"
        ? "Paused"
        : !plan
          ? "Focus time"
          : phase === "focus"
            ? "Focus"
            : phase === "long-break"
              ? "Long break"
              : "Short break";
    const endBreak = () => {
      setSession(skipBreak(session, Date.now()));
      setNow(Date.now());
      void studySelectionFeedback();
    };

    return (
      <div className="mx-auto max-w-xl pb-24 md:pb-8">
        <section className="premium-reveal flex flex-col items-center pt-2 text-center">
          <StudyClock remaining={remaining} total={session.durationMs} label={clockLabel} />

          {plan && (
            <div
              className="mb-7 -mt-4 flex items-center gap-3 text-xs text-muted-foreground"
              role="img"
              aria-label={`${cycleDone} of ${rounds} focus rounds done`}
            >
              <span className="flex gap-1.5" aria-hidden="true">
                {Array.from({ length: rounds }).map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-1.5 w-5 rounded-sm border border-foreground/30",
                      index < cycleDone && "border-foreground/60 bg-foreground/60",
                      index === cycleDone && !onBreak && "border-foreground/60",
                    )}
                  />
                ))}
              </span>
              <span>
                {onBreak
                  ? `${cycleDone} of ${rounds} rounds done`
                  : `Round ${cycleDone + 1} of ${rounds}`}
              </span>
            </div>
          )}

          <div className="study-now">
            {onBreak ? (
              <>
                <span>{phase === "long-break" ? "Long break" : "Break time"}</span>
                <strong className="font-normal">Step away for a moment.</strong>
                <small>Up next: {current.name}</small>
              </>
            ) : (
              <>
                <span>Now studying</span>
                <strong className="font-normal">{current.name}</strong>
                {current.courseName && <small>{current.courseName}</small>}
              </>
            )}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              className={roundIconButton}
              onClick={() =>
                goTo((session.currentIndex - 1 + session.items.length) % session.items.length)
              }
              aria-label="Previous assignment"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" className={pillButton} onClick={pauseOrResume}>
              {session.status === "running" ? (
                <CirclePause className="h-4 w-4" />
              ) : (
                <CirclePlay className="h-4 w-4" />
              )}
              {session.status === "running" ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              className={roundIconButton}
              onClick={() => goTo(nextUnfinished(session, session.currentIndex))}
              aria-label="Next assignment"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {onBreak ? (
            <button type="button" onClick={endBreak} className={cn(textButton, "mt-5")}>
              Skip break
            </button>
          ) : (
            <button
              type="button"
              onClick={finishItem}
              className={cn(textButton, "mt-5 inline-flex items-center gap-1.5")}
            >
              <Check className="h-4 w-4" /> Finish this task
            </button>
          )}
        </section>

        <section className="mt-12 px-1">
          <header className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm text-muted-foreground">Up next</h2>
            <span className="text-xs text-muted-foreground">
              {completed.size} of {session.items.length} finished
            </span>
          </header>
          <ol className="mt-2 space-y-2">
            {session.items.map((item, index) => {
              const done = completed.has(item.id);
              const isCurrent = index === session.currentIndex;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-lg border px-4",
                    isCurrent && !done ? "border-foreground/50" : "border-foreground/15",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    className="flex min-h-14 w-full items-center gap-3.5 py-3 text-left"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums",
                        done
                          ? "border-foreground/40 bg-foreground/10"
                          : isCurrent
                            ? "border-foreground/60"
                            : "border-foreground/25 text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[15px]",
                          done && "line-through opacity-55",
                          !isCurrent && !done && "text-foreground/80",
                        )}
                      >
                        {item.name}
                      </span>
                      {item.courseName && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.courseName}
                        </span>
                      )}
                    </span>
                    {session.perItem && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {itemMinutes(item)} min
                      </span>
                    )}
                  </button>
                  {item.source === "canvas" && (
                    <AssignmentDescriptionLink
                      assignmentId={Number(item.id.replace("canvas:", ""))}
                      className="mb-3 ml-[2.125rem]"
                    />
                  )}
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className={cn(textButton, "mt-6")}
            onClick={() => {
              if (window.confirm("End this study session? Your timer progress will be cleared.")) {
                setSummary(session);
                setSession(null);
              }
            }}
          >
            End session
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24 md:pb-8">
      <header className="premium-reveal px-1">
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">Study session</h1>
      </header>

      {summary && (
        <div className="glass-panel flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm">
            Session finished · {summary.completedItemIds.length} of {summary.items.length} done
            {summary.pomodoro && (summary.round ?? 0) > 0
              ? ` · ${summary.round} focus ${summary.round === 1 ? "block" : "blocks"}`
              : ""}
          </p>
          <div className="flex gap-5">
            <button
              type="button"
              className={textButton}
              onClick={() => {
                setSummary(null);
                setSelected(summary.items);
              }}
            >
              Plan another
            </button>
            <button type="button" className={textButton} onClick={() => setSummary(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid items-stretch gap-5 lg:h-[calc(100dvh-13rem)] lg:min-h-[36rem] lg:grid-cols-2">
        {/* Left: what to study, then how long. */}
        <GlassCard className="premium-reveal flex flex-col gap-6 lg:min-h-0">
          <section className="flex min-h-0 flex-1 flex-col gap-4">
            <StepHeading
              step={1}
              title="Pick assignments"
              trailing={selected.length > 0 ? `${selected.length} picked` : undefined}
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search"
                  aria-label="Search assignments or classes"
                  className="pl-9"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(event) => setShowCompleted(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Include submitted
              </label>
            </div>

            {assignments.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : assignments.error ? (
              <ErrorState
                message={assignments.error.message}
                onRetry={() => void assignments.refetch()}
              />
            ) : candidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No matches.</p>
            ) : (
              <ul className="max-h-[17.5rem] space-y-2 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1">
                {candidates.map((assignment) => {
                  const item = canvasItem(assignment);
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <li key={assignment.id}>
                      <button
                        type="button"
                        onClick={() => toggleItem(item)}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3.5 rounded-lg border px-4 py-3 text-left transition-colors",
                          isSelected
                            ? "border-foreground/50"
                            : "border-foreground/15 hover:border-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                            isSelected
                              ? "border-foreground/70 bg-foreground text-background"
                              : "border-foreground/30",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px]">{assignment.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.courseName || "Canvas"}
                          </span>
                        </span>
                        {assignment.due_at && (
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {new Date(assignment.due_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {hiddenCount > 0 && (
              <p className="text-xs text-muted-foreground">Search to find {hiddenCount} more.</p>
            )}

            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addManual();
              }}
            >
              <Input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                maxLength={160}
                placeholder="Add your own task"
                aria-label="Add your own task"
              />
              <button
                type="submit"
                disabled={!manualName.trim()}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-foreground/15 px-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </form>
          </section>

          <div className="h-px shrink-0 bg-foreground/10" aria-hidden="true" />

          <section className="shrink-0 space-y-4">
            <StepHeading step={2} title="Choose time" trailing={plan} />

            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How to time it">
              {TIME_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={timeMode === mode.id}
                  onClick={() => changeTimeMode(mode.id)}
                  className={cn(
                    choiceButton(timeMode === mode.id),
                    "whitespace-nowrap px-1.5 text-xs sm:px-3 sm:text-sm",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {timeMode === "total" && (
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  {PRESETS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setDuration(minutes)}
                      aria-pressed={duration === minutes}
                      className={cn(choiceButton(duration === minutes), "px-0 tabular-nums")}
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Custom</span>
                  <MinutesField value={duration} onChange={setDuration} label="Total minutes" />
                </label>
              </div>
            )}

            {timeMode === "per" &&
              (selected.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Pick assignments first.
                </p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {selected.map((item) => (
                    <li
                      key={item.id}
                      className="flex min-h-12 items-center gap-3 rounded-lg border border-foreground/15 px-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                      <MinutesField
                        value={minutesFor(item)}
                        onChange={(minutes) =>
                          setMinutesById((current) => ({ ...current, [item.id]: minutes }))
                        }
                        label={`Minutes for ${item.name}`}
                      />
                    </li>
                  ))}
                </ul>
              ))}

            {timeMode === "pomodoro" && (
              <div className="space-y-3">
                <div
                  className="grid gap-2 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label="Pomodoro length"
                >
                  {POMODORO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-checked={presetId === preset.id}
                      onClick={() => changePreset(preset.id)}
                      className={choiceButton(presetId === preset.id)}
                    >
                      {preset.plan.focusMs / 60_000} / {preset.plan.shortBreakMs / 60_000}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={presetId === "custom"}
                    onClick={() => changePreset("custom")}
                    className={choiceButton(presetId === "custom")}
                  >
                    Custom
                  </button>
                </div>
                {presetId === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    {CUSTOM_FIELDS.map(({ key, label, unit }) => (
                      <label key={key} className="block text-xs text-muted-foreground">
                        {label}
                        <span className="mt-1 flex items-center gap-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={POMODORO_LIMITS[key].min}
                            max={POMODORO_LIMITS[key].max}
                            value={custom[key]}
                            onChange={(event) => changeCustom(key, event.target.value)}
                            onBlur={() =>
                              changeCustom(
                                key,
                                String(
                                  key === "focus"
                                    ? chosenPlan.focusMs / 60_000
                                    : key === "shortBreak"
                                      ? chosenPlan.shortBreakMs / 60_000
                                      : key === "longBreak"
                                        ? chosenPlan.longBreakMs / 60_000
                                        : chosenPlan.roundsBeforeLongBreak,
                                ),
                              )
                            }
                            className="h-9 w-full text-center text-sm text-foreground"
                            aria-label={`${label} (${unit})`}
                          />
                          <span className="shrink-0">{unit}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Long break of {chosenPlan.longBreakMs / 60_000} min after every{" "}
                  {chosenPlan.roundsBeforeLongBreak} blocks.
                </p>
              </div>
            )}
          </section>
        </GlassCard>

        {/* Right: the session, in order, ready to start. */}
        <GlassCard
          className="premium-reveal flex flex-col lg:min-h-0"
          title="Your session"
          action={
            <span className="text-xs tabular-nums text-muted-foreground">
              {selected.length} {selected.length === 1 ? "task" : "tasks"}
            </span>
          }
        >
          {selected.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
              Nothing picked yet.
            </p>
          ) : (
            <ol className="space-y-2 pr-1 lg:max-h-[45%] lg:overflow-y-auto">
              {plannedItems.map((item, index) => (
                <li
                  key={item.id}
                  className="group flex min-h-12 items-center gap-3 rounded-lg border border-foreground/15 px-3"
                >
                  <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.name}</span>
                    {item.courseName && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.courseName}
                      </span>
                    )}
                  </span>
                  {timeMode === "per" && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {item.minutes} min
                    </span>
                  )}
                  <span className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="rounded-full p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                      aria-label={`Move ${item.name} up`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === selected.length - 1}
                      onClick={() => move(index, 1)}
                      className="rounded-full p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                      aria-label={`Move ${item.name} down`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleItem(item)}
                      className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-6">
            <SessionRing
              segments={
                timeMode === "per"
                  ? plannedItems.map((item) => item.minutes ?? 25)
                  : selected.map(() => 1)
              }
              value={plan}
              label={TIME_MODES.find((mode) => mode.id === timeMode)?.label ?? ""}
            />
            {selected.length > 0 && timeMode !== "pomodoro" && (
              <p className="text-xs tabular-nums text-muted-foreground">
                Ends around{" "}
                {new Date(
                  now +
                    (timeMode === "per"
                      ? perItemTotal
                      : Math.min(480, Math.max(1, Math.round(duration || 25)))) *
                      60_000,
                ).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </p>
            )}
          </div>

          <button
            type="button"
            className={cn(pillButton, "mt-5 w-full")}
            disabled={!canStart}
            onClick={start}
          >
            Start
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
