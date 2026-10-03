import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
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
import { getAllAssignmentsFn, type AssignmentItem } from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";
import { ErrorState, Skeleton } from "@/components/glass-card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { studySelectionFeedback, studySuccessFeedback } from "@/lib/study-session-feedback";
import { useStudySession } from "@/hooks/use-study-session";
import {
  compareByDueDate,
  endOfAheadWindow,
  isAssignmentComplete,
  isAssignmentVisible,
} from "@/lib/assignment-window";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import {
  createStudySession,
  remainingForSession,
  type StudySessionItem,
  type StudySessionSnapshot,
} from "@/lib/study-session";

import { assignmentsQueryOptions as assignmentsQO } from "@/lib/canvas.queries";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";

const PRESETS = [15, 25, 45, 60];

const pillButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:border disabled:border-foreground/15 disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100 disabled:hover:opacity-100";
const roundIconButton =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-30";
const textButton =
  "text-sm text-muted-foreground transition-colors hover:text-foreground";

export const Route = createFileRoute("/_authenticated/study-session")({
  validateSearch: (search: Record<string, unknown>) => {
    const assignment = Number(search.assignment);
    return {
      assignment: Number.isFinite(assignment) && assignment > 0 ? assignment : undefined,
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
  paused,
}: {
  remaining: number;
  total: number;
  paused: boolean;
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
        <small>{paused ? "Paused" : "Focus time"}</small>
      </div>
    </div>
  );
}

function StudySessionPage() {
  const { assignment: requestedAssignment } = Route.useSearch();
  const assignments = useQuery(assignmentsQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const { session, setSession, ready } = useStudySession();
  const [selected, setSelected] = useState<StudySessionItem[]>([]);
  const [manualName, setManualName] = useState("");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [duration, setDuration] = useState(25);
  const [now, setNow] = useState(() => Date.now());
  const [summary, setSummary] = useState<StudySessionSnapshot | null>(null);
  const selectedFromLink = useRef<number | null>(null);

  useEffect(() => {
    if (!requestedAssignment || selectedFromLink.current === requestedAssignment) return;
    const assignment = assignments.data?.find((item) => item.id === requestedAssignment);
    if (!assignment) return;
    setSelected((items) => {
      const next = canvasItem(assignment);
      return items.some((item) => item.id === next.id) ? items : [next, ...items];
    });
    selectedFromLink.current = requestedAssignment;
  }, [assignments.data, requestedAssignment]);

  useEffect(() => {
    if (!session || session.status !== "running") return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== "running" || remainingForSession(session, now) > 0) return;
    setSummary(session);
    setSession(null);
    void studySuccessFeedback();
    toast.success("Study session complete");
  }, [now, session, setSession]);

  const { candidates, hiddenCount } = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    const matching = (assignments.data ?? [])
      .filter((item) => {
        if (!isAssignmentVisible(item, completed.has(item.id), showCompleted, now)) {
          return false;
        }
        if (!needle) return true;
        return `${item.name} ${item.course_name} ${item.course_code}`
          .toLowerCase()
          .includes(needle);
      })
      .sort(compareByDueDate);
    // A study session is about what is coming up. Searching finds anything;
    // otherwise the list stays inside the shared window (3 days back to 4
    // weeks ahead), which leaves out undated and far-off work.
    if (needle) return { candidates: matching, hiddenCount: 0 };
    const end = endOfAheadWindow(now);
    const inWindow = matching.filter(
      (item) => item.due_at && new Date(item.due_at).getTime() <= end,
    );
    return { candidates: inWindow, hiddenCount: matching.length - inWindow.length };
  }, [assignments.data, completed, search, showCompleted]);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);

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

  function start() {
    if (!selected.length) return;
    const boundedDuration = Math.min(480, Math.max(1, Math.round(duration)));
    setDuration(boundedDuration);
    setSummary(null);
    setSession(createStudySession(selected, boundedDuration));
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
      update({
        completedItemIds,
        currentIndex: nextUnfinished({ ...session, completedItemIds }, session.currentIndex),
      });
      void studySuccessFeedback();
    };

    return (
      <div className="mx-auto max-w-xl pb-24 md:pb-8">
        <section className="premium-reveal flex flex-col items-center pt-2 text-center">
          <StudyClock
            remaining={remaining}
            total={session.durationMs}
            paused={session.status === "paused"}
          />

          <div className="study-now">
            <span>Now studying</span>
            <strong className="font-normal">{current.name}</strong>
            {current.courseName && <small>{current.courseName}</small>}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              className={roundIconButton}
              onClick={() =>
                update({
                  currentIndex:
                    (session.currentIndex - 1 + session.items.length) % session.items.length,
                })
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
              onClick={() => update({ currentIndex: nextUnfinished(session, session.currentIndex) })}
              aria-label="Next assignment"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={finishItem}
            className={cn(textButton, "mt-5 inline-flex items-center gap-1.5")}
          >
            <Check className="h-4 w-4" /> Finish this task
          </button>
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
                    onClick={() => update({ currentIndex: index })}
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
    <div className="mx-auto max-w-5xl space-y-8 pb-24 md:pb-8">
      <header className="premium-reveal px-1">
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">Study session</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Choose what to work on and for how long. CanvasPro keeps your place, even if you close
          the app.
        </p>
      </header>

      {summary && (
        <div className="rounded-lg border border-foreground/15 p-5">
          <p className="text-base">Session finished</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.completedItemIds.length} of {summary.items.length} tasks completed.
          </p>
          <div className="mt-3 flex gap-5">
            <button
              type="button"
              className={cn(textButton, "underline decoration-foreground/25 underline-offset-2")}
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

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="min-w-0 px-1">
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
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-foreground/15 px-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
            >
              Add
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search assignments or classes"
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
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the last 3 days through the next 4 weeks.
            {hiddenCount > 0 && ` Search to find ${hiddenCount} more.`}
          </p>

          <div className="mt-4">
            {assignments.isPending ? (
              <div className="space-y-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : assignments.error ? (
              <ErrorState
                message={assignments.error.message}
                onRetry={() => void assignments.refetch()}
              />
            ) : candidates.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No matching Canvas assignments. You can still add your own above.
              </p>
            ) : (
              <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                {candidates.map((assignment) => {
                  const item = canvasItem(assignment);
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <li
                      key={assignment.id}
                      className="rounded-lg border border-foreground/15 px-4"
                    >
                      <button
                        type="button"
                        disabled={isSelected}
                        onClick={() => {
                          setSelected((items) => [...items, item]);
                          void studySelectionFeedback();
                        }}
                        className="flex min-h-14 w-full items-center gap-3.5 py-3 text-left transition-opacity hover:opacity-80 disabled:opacity-45"
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground/30",
                            isSelected && "border-foreground/40 bg-foreground/10",
                          )}
                        >
                          {isSelected ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px]">{assignment.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.courseName || "Canvas"}
                          </span>
                        </span>
                        {assignment.due_at && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {new Date(assignment.due_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </button>
                      <AssignmentDescriptionLink
                        assignmentId={assignment.id}
                        className="mb-3 ml-[2.125rem]"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-foreground/15 p-6">
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="text-base">Your session</h2>
              <span className="text-xs text-muted-foreground">
                {selected.length} {selected.length === 1 ? "task" : "tasks"}
              </span>
            </header>

            {selected.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing chosen yet. Pick an assignment from the list to begin.
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {selected.map((item, index) => (
                  <li
                    key={item.id}
                    className="group flex min-h-11 items-center gap-2 rounded-lg border border-foreground/15 px-3"
                  >
                    <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                    <span className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          setSelected((items) => {
                            const next = [...items];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            return next;
                          })
                        }
                        className="rounded-full p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                        aria-label={`Move ${item.name} up`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === selected.length - 1}
                        onClick={() =>
                          setSelected((items) => {
                            const next = [...items];
                            [next[index + 1], next[index]] = [next[index], next[index + 1]];
                            return next;
                          })
                        }
                        className="rounded-full p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                        aria-label={`Move ${item.name} down`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((items) =>
                            items.filter((candidate) => candidate.id !== item.id),
                          )
                        }
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

            <div className="mt-6">
              <p className="text-sm text-muted-foreground">How long?</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDuration(minutes)}
                    aria-pressed={duration === minutes}
                    className={cn(
                      "min-h-9 rounded-lg border text-sm tabular-nums transition-colors",
                      duration === minutes
                        ? "border-foreground/60 text-foreground"
                        : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Custom (minutes)</span>
                <Input
                  type="number"
                  min={1}
                  max={480}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="h-9 w-20 text-center"
                  aria-label="Custom session minutes"
                />
              </label>
            </div>

            <button
              type="button"
              className={cn(pillButton, "mt-6 w-full")}
              disabled={!selected.length || !Number.isFinite(duration) || duration < 1}
              onClick={start}
            >
              Start {Number.isFinite(duration) && duration >= 1 ? `${Math.round(duration)} min` : ""}{" "}
              session
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
