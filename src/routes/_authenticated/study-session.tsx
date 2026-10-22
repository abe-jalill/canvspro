import { mergeAssignments } from "@/lib/assignment-sources";
import { useCustomAssignments } from "@/lib/custom-assignments";
import { coursesQueryOptions } from "@/lib/canvas.queries";
import { CachedAssignmentEstimate } from "@/components/assignment-estimate";
import { formatAssignmentDue } from "@/lib/assignment-due";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
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
  buildPomodoroCustom,
  buildPomodoroPlan,
  createStudySession,
  focusItem,
  formatStudyClock,
  isBreak,
  itemMinutes,
  nextItemSession,
  phaseOf,
  readStudySetup,
  remainingForSession,
  skipBreak,
  totalItemMinutes,
  type PomodoroPresetId,
  type StudySessionItem,
  type StudySessionSnapshot,
} from "@/lib/study-session";

import { assignmentsQueryOptions as assignmentsQO } from "@/lib/canvas.queries";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { AssignmentProgressEditor } from "@/components/assignment-progress";
import { FocusNoiseControls } from "@/components/focus-noise";
import { classColor } from "@/lib/class-color";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PRESETS = [15, 25, 45, 60, 90];
const TIME_MODE_KEY = "canvas:study-time-mode";
const POMODORO_PREF_KEY = "canvas:study-pomodoro";
const POMODORO_PRESET_KEY = "canvas:study-pomodoro-preset";
const POMODORO_CUSTOM_KEY = "canvas:study-pomodoro-custom";
/** The time choice, saved to the account; the iPhone's Study uses it too. */
const STUDY_SETUP_KEY = "study-setup";

type TimeMode = "total" | "per" | "pomodoro";
type PomodoroChoice = PomodoroPresetId | "custom";
type CustomField = "focus" | "shortBreak" | "longBreak" | "rounds";

const TIME_MODES: { id: TimeMode; label: string }[] = [
  { id: "total", label: "Total time" },
  { id: "per", label: "Per task" },
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
    // Canvas ids are positive; your own tasks have negative ids.
    const validId = (id: number) => Number.isInteger(id) && id !== 0;
    // `picks` preselects several assignments at once, e.g. ?picks=12,34,56.
    const picks =
      typeof search.picks === "string" || typeof search.picks === "number"
        ? String(search.picks)
            .split(",")
            .map(Number)
            .filter(validId)
            .join(",")
        : "";
    return {
      assignment: validId(assignment) ? assignment : undefined,
      ...(picks ? { picks } : {}),
    };
  },
  head: () => ({ meta: [{ title: "Study Session — CoursePro" }] }),
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

const formatTime = formatStudyClock;

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

/** "4:52 PM". */
function clockTime(at: number) {
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * The block's time on a ring that empties as it runs. The arc is drawn only
 * while time is left, so a fresh block never shows a stray dot, and a reading
 * past an hour ("1:29:57") gets a smaller size so it always fits inside.
 */
function StudyClock({
  remaining,
  total,
  label,
  tone,
}: {
  remaining: number;
  total: number;
  label: string;
  tone: "focus" | "break" | "paused";
}) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const left = total <= 0 ? 0 : Math.min(1, Math.max(0, remaining / total));
  const time = formatTime(remaining);

  return (
    <div
      className="study-clock"
      data-tone={tone}
      data-long={time.split(":").length > 2 ? "" : undefined}
      role="timer"
      aria-label={`${time} left`}
    >
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle className="study-clock__track" cx="64" cy="64" r={radius} />
        {left > 0 && (
          <circle
            className="study-clock__progress"
            cx="64"
            cy="64"
            r={radius}
            strokeDasharray={`${circumference * left} ${circumference}`}
          />
        )}
      </svg>
      <div className="study-clock__time" aria-hidden="true">
        <span>{time}</span>
        <small>{label}</small>
      </div>
    </div>
  );
}

/** The whole session as a ring: one arc per task, sized by its share of the time, with the time inside. */
function SessionRing({
  segments,
  value,
  label,
}: {
  segments: number[];
  value: string;
  label: string;
}) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, minutes) => sum + minutes, 0);
  const gap = segments.length > 1 ? 4 : 0;
  let offset = 0;
  return (
    <div className="relative h-48 w-48 shrink-0" role="img" aria-label={`${label}: ${value}`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="4"
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
                strokeWidth="4"
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
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {/* "1 hr 30 min", as under Choose time, a size down so it fits the ring. */}
        <span
          className={cn(
            "font-medium leading-none tracking-tight tabular-nums",
            value.length > 7 ? "text-2xl" : "text-[2rem]",
          )}
        >
          {value}
        </span>
        <span className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

/** A section title inside a card, with a quiet value on the right. */
function SectionTitle({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="flex-1 text-base font-normal tracking-tight">{title}</h2>
      {trailing && <span className="text-xs tabular-nums text-muted-foreground">{trailing}</span>}
    </div>
  );
}


/** How many assignments show before "Show more". */
const SHORT_LIST = 6;

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
  const manualAssignments = useCustomAssignments();
  const courses = useQuery(coursesQueryOptions);
  const allAssignments = useMemo(() => mergeAssignments(assignments.data ?? [], manualAssignments.list, courses.data ?? []), [assignments.data, manualAssignments.list, courses.data]);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const metaMap = useAssignmentMetaMap();
  const { session, setSession, ready } = useStudySession();
  const [selected, setSelected] = useState<StudySessionItem[]>([]);
  const [minutesById, setMinutesById] = useState<Record<string, number>>({});
  const [manualName, setManualName] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  // Finished work isn't offered for a new session.
  const showCompleted = false;
  const [duration, setDuration] = useState(25);
  const [timeMode, setTimeMode] = useState<TimeMode>("total");
  const [presetId, setPresetId] = useState<PomodoroChoice>("classic");
  // Kept as text while typing so a field can be empty for a moment.
  const [custom, setCustom] = useState<Record<CustomField, string>>(CUSTOM_DEFAULTS);
  const [now, setNow] = useState(() => Date.now());
  const [summary, setSummary] = useState<StudySessionSnapshot | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const selectedFromLink = useRef<string | null>(null);

  useEffect(() => {
    const ids = [
      ...(requestedAssignment ? [requestedAssignment] : []),
      ...(requestedPicks ? requestedPicks.split(",").map(Number) : []),
    ];
    const key = ids.join(",");
    if (!ids.length || selectedFromLink.current === key || !assignments.data) return;
    // Your own tasks are looked up too, once they've loaded.
    if (ids.some((id) => id < 0) && manualAssignments.isLoading) return;
    const found = ids
      .map((id) => allAssignments.find((item) => item.id === id))
      .filter((item): item is AssignmentItem => Boolean(item))
      .map(canvasItem);
    if (!found.length) return;
    setSelected((items) => [
      ...found.filter((next) => !items.some((item) => item.id === next.id)),
      ...items,
    ]);
    selectedFromLink.current = key;
  }, [assignments.data, allAssignments, manualAssignments.isLoading, requestedAssignment, requestedPicks]);

  // The last time choice is saved to the account, so the iPhone and every
  // browser open with it. Before that it was kept in this browser (and before
  // this page had modes, Pomodoro was a switch): carried over once.
  const studySetup = useUserPreferenceKey<unknown>(STUDY_SETUP_KEY, null);
  const setupApplied = useRef(false);
  useEffect(() => {
    if (!studySetup.ready || setupApplied.current) return;
    setupApplied.current = true;
    const synced = readStudySetup(studySetup.value);
    if (synced) {
      setTimeMode(synced.mode);
      setPresetId(synced.preset);
      setCustom(
        Object.fromEntries(
          CUSTOM_FIELDS.map(({ key }) => [key, String(synced.custom[key])]),
        ) as Record<CustomField, string>,
      );
      return;
    }
    try {
      const savedMode = window.localStorage.getItem(TIME_MODE_KEY);
      const mode: TimeMode =
        savedMode === "total" || savedMode === "per" || savedMode === "pomodoro"
          ? savedMode
          : window.localStorage.getItem(POMODORO_PREF_KEY) === "on"
            ? "pomodoro"
            : "total";
      const savedPreset = window.localStorage.getItem(POMODORO_PRESET_KEY);
      const preset: PomodoroChoice =
        savedPreset === "custom" || POMODORO_PRESETS.some((p) => p.id === savedPreset)
          ? (savedPreset as PomodoroChoice)
          : "classic";
      const savedCustom = JSON.parse(window.localStorage.getItem(POMODORO_CUSTOM_KEY) ?? "null");
      const customText = Object.fromEntries(
        CUSTOM_FIELDS.map(({ key }) => [
          key,
          String((savedCustom && typeof savedCustom === "object" && savedCustom[key]) ?? CUSTOM_DEFAULTS[key]),
        ]),
      ) as Record<CustomField, string>;
      setTimeMode(mode);
      setPresetId(preset);
      setCustom(customText);
      if (savedMode || savedPreset || savedCustom) {
        studySetup.set({ mode, preset, custom: buildPomodoroCustom(customText) });
      }
    } catch {
      /* the defaults are fine */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studySetup.ready]);

  // Saved a moment after the last change, so typing a custom length is one save.
  const saveTimer = useRef<number | undefined>(undefined);
  function remember(next: { mode?: TimeMode; preset?: PomodoroChoice; custom?: typeof custom }) {
    const setup = {
      mode: next.mode ?? timeMode,
      preset: next.preset ?? presetId,
      custom: buildPomodoroCustom(next.custom ?? custom),
    };
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => studySetup.set(setup), 800);
  }

  function changeTimeMode(mode: TimeMode) {
    setTimeMode(mode);
    remember({ mode });
    void studySelectionFeedback();
  }

  function changePreset(id: PomodoroChoice) {
    setPresetId(id);
    remember({ preset: id });
  }

  function changeCustom(key: CustomField, value: string) {
    const next = { ...custom, [key]: value };
    setCustom(next);
    remember({ custom: next });
  }

  /** The plan for the choice on screen; custom fields are clamped to safe values. */
  const chosenPlan =
    presetId === "custom"
      ? buildPomodoroPlan(custom)
      : (POMODORO_PRESETS.find((preset) => preset.id === presetId) ?? POMODORO_PRESETS[0]).plan;

  const assignmentById = useMemo(
    () => new Map(allAssignments.map((item) => [`canvas:${item.id}`, item])),
    [allAssignments],
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

  // Before a session starts, "Ends around" keeps up with the clock.
  useEffect(() => {
    if (!ready || session) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [ready, session]);

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
    const visible = allAssignments
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
  }, [allAssignments, completed, search, showCompleted]);

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

  // Inside the ring, the same words as Choose time ("25 min", "1 hr 30 min",
  // "25 / 5"), and nothing while the custom time isn't a real one.
  const ringValue =
    timeMode === "pomodoro"
      ? `${chosenPlan.focusMs / 60_000} / ${chosenPlan.shortBreakMs / 60_000}`
      : timeMode === "per"
        ? formatMinutes(perItemTotal)
        : durationValid
          ? formatMinutes(Math.min(480, Math.round(duration)))
          : "—";
  const ringLabel =
    timeMode === "pomodoro" ? "Focus / break" : timeMode === "per" ? "In all" : "Total time";

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
    // On a phone Start sits at the bottom of the list; the timer is at the top.
    window.scrollTo({ top: 0 });
    void studySuccessFeedback();
  }

  if (!ready) {
    return <Skeleton className="mx-auto mt-16 h-48 max-w-2xl" />;
  }

  if (session) {
    const remaining = remainingForSession(session, now);
    const current = session.items[Math.min(session.currentIndex, session.items.length - 1)];
    const completed = new Set(session.completedItemIds);
    const several = session.items.length > 1;

    const update = (patch: Partial<StudySessionSnapshot>) => setSession({ ...session, ...patch });
    const goTo = (index: number) => {
      // Tapping the task already on screen leaves its timer alone.
      if (index === session.currentIndex) return;
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
    const paused = session.status === "paused";
    const rounds = plan?.roundsBeforeLongBreak ?? 0;
    // Focus blocks finished in the current cycle (a long break closes a full cycle).
    const cycleDone = plan ? (phase === "long-break" ? rounds : (session.round ?? 0) % rounds) : 0;
    const phaseLabel = paused
      ? "Paused"
      : phase === "long-break"
        ? "Long break"
        : phase === "short-break"
          ? "Short break"
          : "Focus";
    const tone = paused ? "paused" : onBreak ? "break" : "focus";
    const endBreak = () => {
      setSession(skipBreak(session, Date.now()));
      setNow(Date.now());
      void studySelectionFeedback();
    };
    const courseIds = (courses.data ?? []).map((course) => course.id);
    const colorOf = (item: StudySessionItem) => {
      const courseId = assignmentById.get(item.id)?.course_id;
      return courseId != null ? classColor(courseId, courseIds) : undefined;
    };
    const currentColor = colorOf(current);
    const currentAssignmentId =
      current.source === "canvas" ? Number(current.id.replace("canvas:", "")) : null;

    return (
      <div className="mx-auto w-full max-w-5xl pb-24 md:pb-8">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          {/* The timer and what's being worked on, in one lit card like Today's Next up. */}
          <section className="study-focus-card premium-reveal rounded-[1.75rem] px-5 pb-8 pt-5 sm:px-8">
            <div className="relative flex min-h-6 items-center justify-between gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]",
                  tone === "focus"
                    ? "text-primary"
                    : tone === "break"
                      ? "text-status-warning"
                      : "text-muted-foreground",
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full bg-current", !paused && "study-live-dot")}
                  aria-hidden="true"
                />
                {phaseLabel}
              </span>
              {!paused && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  Ends {clockTime(now + remaining)}
                </span>
              )}
            </div>

            <StudyClock
              remaining={remaining}
              total={session.durationMs}
              label={`of ${formatMinutes(Math.max(1, Math.round(session.durationMs / 60_000)))}`}
              tone={tone}
            />

            {plan && (
              <div
                className="relative -mt-2 mb-6 flex items-center justify-center gap-3 text-xs tabular-nums text-muted-foreground"
                role="img"
                aria-label={`${cycleDone} of ${rounds} focus rounds done`}
              >
                <span className="flex gap-1.5" aria-hidden="true">
                  {Array.from({ length: rounds }).map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-1 w-5 rounded-full bg-foreground/15",
                        index < cycleDone && "bg-primary",
                        index === cycleDone && !onBreak && "bg-primary/45",
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

            <div className="relative mx-auto max-w-md text-center">
              {onBreak ? (
                <>
                  <p className="text-xl font-semibold leading-snug tracking-[-0.01em]">
                    Step away for a moment.
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">Up next: {current.name}</p>
                </>
              ) : (
                <>
                  <p className="text-balance text-xl font-semibold leading-snug tracking-[-0.01em]">
                    {current.name}
                  </p>
                  {current.courseName && (
                    <p className="mt-1.5 flex items-baseline justify-center gap-2 text-sm text-muted-foreground">
                      {currentColor && (
                        <span
                          className="inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
                          style={{ backgroundColor: currentColor }}
                          aria-hidden="true"
                        />
                      )}
                      <span>{current.courseName}</span>
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="relative mt-7 flex items-center justify-center gap-3">
              {several && (
                <button
                  type="button"
                  className={roundIconButton}
                  onClick={() =>
                    goTo((session.currentIndex - 1 + session.items.length) % session.items.length)
                  }
                  aria-label="Previous task"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                className={cn(pillButton, "min-w-[9.5rem] rounded-full")}
                onClick={pauseOrResume}
              >
                {session.status === "running" ? (
                  <CirclePause className="h-4 w-4" />
                ) : (
                  <CirclePlay className="h-4 w-4" />
                )}
                {session.status === "running" ? "Pause" : "Resume"}
              </button>
              {several && (
                <button
                  type="button"
                  className={roundIconButton}
                  onClick={() => goTo(nextUnfinished(session, session.currentIndex))}
                  aria-label="Next task"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
              {onBreak ? (
                <button type="button" onClick={endBreak} className={textButton}>
                  Skip break
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finishItem}
                  className={cn(textButton, "inline-flex min-h-9 items-center gap-1.5")}
                >
                  <Check className="h-4 w-4" /> Finish this task
                </button>
              )}
              {currentAssignmentId != null && !onBreak && (
                <CachedAssignmentEstimate assignmentId={currentAssignmentId} />
              )}
            </div>

            <FocusNoiseControls className="relative mt-6" />
          </section>

          <GlassCard
            className="premium-reveal lg:sticky lg:top-4"
            title="This session"
            action={
              <span className="text-xs tabular-nums text-muted-foreground">
                {completed.size} of {session.items.length} done
              </span>
            }
          >
            <div
              className="-mt-2 mb-4 h-1 overflow-hidden rounded-full bg-foreground/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={session.items.length}
              aria-valuenow={completed.size}
              aria-label={`${completed.size} of ${session.items.length} tasks done`}
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${(completed.size / session.items.length) * 100}%` }}
              />
            </div>
            <ol className="-mx-2 space-y-1">
              {session.items.map((item, index) => {
                const done = completed.has(item.id);
                const isCurrent = index === session.currentIndex;
                const color = colorOf(item);
                const detail = [
                  item.courseName,
                  session.perItem ? formatMinutes(itemMinutes(item)) : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "rounded-xl transition-colors",
                      isCurrent ? "bg-primary/[0.08]" : "hover:bg-foreground/[0.04]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      aria-current={isCurrent ? "step" : undefined}
                      className="flex w-full items-start gap-3 px-2 py-2.5 text-left"
                    >
                      <span
                        className={cn(
                          "mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums",
                          done
                            ? "border-primary bg-primary text-primary-foreground"
                            : isCurrent
                              ? "border-primary text-primary"
                              : "border-foreground/20 text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-[15px] leading-snug",
                            done && "text-muted-foreground line-through decoration-foreground/30",
                          )}
                        >
                          {item.name}
                        </span>
                        {detail && (
                          <span className="mt-1 flex items-baseline gap-2 text-xs tabular-nums text-muted-foreground">
                            {color && (
                              <span
                                className="inline-block h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full"
                                style={{ backgroundColor: color }}
                                aria-hidden="true"
                              />
                            )}
                            <span>{detail}</span>
                          </span>
                        )}
                      </span>
                      {isCurrent && !done && (
                        <span className="mt-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                          Now
                        </span>
                      )}
                    </button>
                    {isCurrent && item.source === "canvas" && (
                      <div className="-mt-1 pb-3 pl-11">
                        <AssignmentDescriptionLink
                          assignmentId={Number(item.id.replace("canvas:", ""))}
                          showProgress={false}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 flex justify-end border-t border-foreground/10 pt-4">
              <button type="button" className={textButton} onClick={() => setConfirmEnd(true)}>
                End session
              </button>
            </div>
          </GlassCard>
        </div>

        <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
          <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl sm:rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>End this session?</AlertDialogTitle>
              <AlertDialogDescription>
                The timer stops. Tasks you finished stay finished.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium transition hover:bg-foreground/5"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmEnd(false);
                  setSummary(session);
                  setSession(null);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90"
              >
                End session
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
          {/* How far you got: saved as each assignment's progress, shown on To-Do. */}
          {(() => {
            const unfinished = summary.items
              .filter((item) => !summary.completedItemIds.includes(item.id))
              .map((item) => allAssignments.find((a) => String(a.id) === item.id))
              .filter((a): a is NonNullable<typeof a> => a != null);
            if (unfinished.length === 0) return null;
            return (
              <div className="w-full space-y-3 border-t border-foreground/10 pt-3">
                <p className="text-sm font-medium">How far did you get?</p>
                {unfinished.map((a) => (
                  <div key={a.id} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{a.name}</p>
                    <AssignmentProgressEditor assignmentId={a.id} courseId={a.course_id} />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Left: what to study. The list grows with the page instead of scrolling in a box. */}
        <GlassCard className="premium-reveal">
          <section className="flex flex-col gap-4">
            <SectionTitle
              title="Pick assignments"
              trailing={selected.length > 0 ? `${selected.length} picked` : undefined}
            />

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search assignments or classes"
                aria-label="Search assignments or classes"
                className="pl-9"
              />
            </label>

            {assignments.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : assignments.error && !assignments.data ? (
              <ErrorState
                message={assignments.error.message}
                onRetry={() => void assignments.refetch()}
              />
            ) : candidates.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {search.trim() ? "No matches." : "Nothing due soon."}
              </p>
            ) : (
              <>
                <ul className="divide-y divide-foreground/10 rounded-xl border border-foreground/10">
                  {(search.trim() || showAll ? candidates : candidates.slice(0, SHORT_LIST)).map(
                    (assignment) => {
                      const item = canvasItem(assignment);
                      const isSelected = selectedIds.has(item.id);
                      const minutes =
                        metaMap.get(assignment.id)?.estimatedMinutes ??
                        defaultEstimateMinutes(assignment);
                      const detail = [
                        item.courseName || "Canvas",
                        assignment.due_at
                          ? formatAssignmentDue(assignment.due_at, Date.now(), false)
                          : null,
                        formatMinutes(minutes),
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li key={assignment.id}>
                          <button
                            type="button"
                            onClick={() => toggleItem(item)}
                            aria-pressed={isSelected}
                            className={cn(
                              "flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl",
                              isSelected ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                                isSelected
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-foreground/30",
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] leading-snug">{assignment.name}</span>
                              <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                                {detail}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    },
                  )}
                </ul>
                {!search.trim() && !showAll && candidates.length > SHORT_LIST && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="self-start rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    Show {candidates.length - SHORT_LIST} more
                  </button>
                )}
              </>
            )}
            {hiddenCount > 0 && !search.trim() && (
              <p className="text-xs text-muted-foreground">
                {hiddenCount} more due later. Search to find them.
              </p>
            )}

            {addingTask ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  addManual();
                  setAddingTask(false);
                }}
              >
                <Input
                  autoFocus
                  value={manualName}
                  onChange={(event) => setManualName(event.target.value)}
                  maxLength={160}
                  placeholder="Your own task"
                  aria-label="Add a task"
                />
                <button
                  type="submit"
                  disabled={!manualName.trim()}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingTask(false);
                    setManualName("");
                  }}
                  className={roundIconButton}
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingTask(true)}
                className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-4 w-4" /> Add a task
              </button>
            )}
          </section>
        </GlassCard>

        {/* Right: the session. It stays in view on wide screens while the list scrolls. */}
        <GlassCard
          className="premium-reveal lg:sticky lg:top-4"
          title="Your session"
          action={
            <span className="text-xs tabular-nums text-muted-foreground">
              {selected.length} {selected.length === 1 ? "task" : "tasks"}
            </span>
          }
        >
          {/* On wide screens Start sits under the ring, so it stays in view; phones keep it last. */}
          <div className="flex flex-col">
          <div className="flex flex-col items-center gap-3">
            <SessionRing
              segments={
                timeMode === "per"
                  ? plannedItems.map((item) => item.minutes ?? 25)
                  : selected.map(() => 1)
              }
              value={ringValue}
              label={ringLabel}
            />
            <p className="h-4 text-xs tabular-nums text-muted-foreground">
              {selected.length === 0 || (timeMode === "total" && !durationValid)
                ? ""
                : timeMode === "pomodoro"
                  ? `Long break every ${chosenPlan.roundsBeforeLongBreak} blocks`
                  : `Ends around ${new Date(
                      now +
                        (timeMode === "per"
                          ? perItemTotal
                          : Math.min(480, Math.max(1, Math.round(duration || 25)))) *
                          60_000,
                    ).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>

          <section className="mt-6 space-y-3 lg:order-2">
            <SectionTitle title="Choose time" trailing={plan} />
            <div
              className="grid grid-cols-3 gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-1"
              role="radiogroup"
              aria-label="How to time it"
            >
              {TIME_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={timeMode === mode.id}
                  onClick={() => changeTimeMode(mode.id)}
                  className={cn(
                    "min-h-9 rounded-lg px-2 text-sm transition-colors",
                    timeMode === mode.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {timeMode === "total" && (
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDuration(minutes)}
                    aria-pressed={duration === minutes}
                    className={cn(choiceButton(duration === minutes), "min-w-12 px-3 tabular-nums")}
                  >
                    {minutes}m
                  </button>
                ))}
                <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  Custom
                  <MinutesField value={duration} onChange={setDuration} label="Total minutes" />
                </label>
              </div>
            )}

            {timeMode === "per" && (
              <p className="text-xs text-muted-foreground">
                Each task gets its own timer. Set the minutes in the list below.
              </p>
            )}

            {timeMode === "pomodoro" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Pomodoro length">
                  {POMODORO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-checked={presetId === preset.id}
                      onClick={() => changePreset(preset.id)}
                      className={cn(choiceButton(presetId === preset.id), "tabular-nums")}
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
              </div>
            )}
          </section>

          <div className="my-6 h-px bg-foreground/10 lg:order-3" aria-hidden="true" />

          {selected.length === 0 ? (
            <p className="rounded-xl border border-dashed border-foreground/15 px-4 py-6 text-center text-sm text-muted-foreground lg:order-4">
              Nothing picked yet.
            </p>
          ) : (
            <ol className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 lg:order-4">
              {plannedItems.map((item, index) => (
                <li key={item.id} className="group flex min-h-12 items-center gap-3 px-3 py-2">
                  <span className="w-4 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug">{item.name}</span>
                    {item.courseName && (
                      <span className="block text-xs text-muted-foreground">
                        {item.courseName}
                      </span>
                    )}
                  </span>
                  {timeMode === "per" && (
                    <MinutesField
                      value={minutesFor(item)}
                      onChange={(minutes) =>
                        setMinutesById((current) => ({ ...current, [item.id]: minutes }))
                      }
                      label={`Minutes for ${item.name}`}
                    />
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

          <button
            type="button"
            className={cn(pillButton, "mt-6 w-full lg:order-1 lg:mt-5")}
            disabled={!canStart}
            onClick={start}
            aria-describedby={!canStart ? "study-start-hint" : undefined}
          >
            Start
          </button>
          {/* Say why Start is greyed out, and where a plain timer is. */}
          {!canStart && (
            <p id="study-start-hint" className="mt-2 text-center text-xs text-muted-foreground lg:order-2">
              {selected.length === 0 ? (
                <>
                  Pick what to work on to start. Just want a timer? Use the quick timer on{" "}
                  <Link to="/dashboard" className="underline underline-offset-2 hover:text-foreground">
                    Today
                  </Link>
                  .
                </>
              ) : (
                "Set how long to study to start."
              )}
            </p>
          )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
