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
  RotateCcw,
  Search,
  TimerReset,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getAllAssignmentsFn, type AssignmentItem } from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";
import { GlassCard, ErrorState, Skeleton } from "@/components/glass-card";
import { PageTabs } from "@/components/page-tabs";
import { STUDY_TABS } from "@/lib/page-tab-sets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { studySelectionFeedback, studySuccessFeedback } from "@/lib/study-session-feedback";
import { useStudySession } from "@/hooks/use-study-session";
import {
  compareByDueDate,
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
  const [showUndated, setShowUndated] = useState(false);
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

  const { candidates, hiddenUndated } = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matching = (assignments.data ?? [])
      .filter((item) => {
        if (!isAssignmentVisible(item, completed.has(item.id), showCompleted, Date.now())) {
          return false;
        }
        if (!needle) return true;
        return `${item.name} ${item.course_name} ${item.course_code}`
          .toLowerCase()
          .includes(needle);
      })
      .sort(compareByDueDate);
    // Work with no due date is tucked away until asked for (or searched for),
    // so the list starts with what is actually coming up.
    if (needle || showUndated) return { candidates: matching, hiddenUndated: 0 };
    const dated = matching.filter((item) => item.due_at);
    return { candidates: dated, hiddenUndated: matching.length - dated.length };
  }, [assignments.data, completed, search, showCompleted, showUndated]);

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
    const progress = Math.min(
      100,
      Math.max(0, ((session.durationMs - remaining) / session.durationMs) * 100),
    );

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
      <div className="mx-auto max-w-6xl space-y-5 pb-24 md:pb-8">
        <header className="premium-reveal px-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Study Session
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            One thing at a time.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            The plan stays out of the way while you focus on the assignment in front of you.
          </p>
        </header>

        <div className="study-active-layout">
          <GlassCard strong className="study-timer-panel premium-card">
            <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>{completed.size} finished</span>
              <span>{Math.round(progress)}% of session</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>

            <StudyClock
              remaining={remaining}
              total={session.durationMs}
              paused={session.status === "paused"}
            />

            <div className="study-now">
              <span>Now studying</span>
              <strong>{current.name}</strong>
              {current.courseName && <small>{current.courseName}</small>}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  update({
                    currentIndex:
                      (session.currentIndex - 1 + session.items.length) % session.items.length,
                  })
                }
                aria-label="Previous assignment"
              >
                <ChevronLeft />
              </Button>
              <Button size="lg" onClick={pauseOrResume}>
                {session.status === "running" ? <CirclePause /> : <CirclePlay />}
                {session.status === "running" ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  update({ currentIndex: nextUnfinished(session, session.currentIndex) })
                }
                aria-label="Next assignment"
              >
                <ChevronRight />
              </Button>
              <Button size="lg" onClick={finishItem}>
                <Check /> Finish task
              </Button>
            </div>
          </GlassCard>

          <GlassCard
            title="Up next"
            subtitle={`${completed.size} of ${session.items.length} finished`}
            className="study-queue premium-card"
          >
            <ol className="space-y-2">
              {session.items.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => update({ currentIndex: index })}
                    className={cn(
                      "glass-inset flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition",
                      index === session.currentIndex && "ring-1 ring-primary/60",
                      completed.has(item.id) && "opacity-55",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs",
                        completed.has(item.id) &&
                          "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {completed.has(item.id) ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm font-medium",
                          completed.has(item.id) && "line-through",
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
                      className="ml-11 mt-1"
                    />
                  )}
                </li>
              ))}
            </ol>
            <Button
              variant="ghost"
              className="mt-4 text-destructive"
              onClick={() => {
                if (
                  window.confirm("End this study session? Your timer progress will be cleared.")
                ) {
                  setSummary(session);
                  setSession(null);
                }
              }}
            >
              <Trash2 /> End session
            </Button>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 md:pb-8">
      <PageTabs tabs={STUDY_TABS} label="Study sections" />
      <header className="premium-reveal px-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Study Session
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Build a focused session.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Choose the work, set a finish line, and let CanvasPro hold your place—even if you close
          the app.
        </p>
      </header>

      {summary && (
        <GlassCard
          title="Session finished"
          subtitle={`${summary.completedItemIds.length} of ${summary.items.length} assignments completed`}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setSummary(null);
                setSelected(summary.items);
              }}
            >
              <RotateCcw /> Plan another
            </Button>
            <Button variant="outline" onClick={() => setSummary(null)}>
              Dismiss
            </Button>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <GlassCard
            title="1 · Choose your focus"
            subtitle="Select Canvas work or add one task of your own."
          >
            <form
              className="mb-5 flex gap-2 border-b border-foreground/10 pb-5"
              onSubmit={(event) => {
                event.preventDefault();
                addManual();
              }}
            >
              <Input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                maxLength={160}
                placeholder="e.g. Draft history introduction"
                aria-label="Assignment name"
              />
              <Button type="submit" disabled={!manualName.trim()}>
                <Plus /> Add
              </Button>
            </form>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search assignments or courses"
                  className="pl-9"
                />
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(event) => setShowCompleted(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Show submitted
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showUndated}
                  onChange={(event) => setShowUndated(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                No due date
              </label>
            </div>
            {hiddenUndated > 0 && (
              <p className="mb-3 text-xs text-muted-foreground">
                {hiddenUndated} item{hiddenUndated === 1 ? "" : "s"} with no due date hidden.
              </p>
            )}
            {assignments.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : assignments.error ? (
              <ErrorState
                message={assignments.error.message}
                onRetry={() => void assignments.refetch()}
              />
            ) : candidates.length === 0 ? (
              <p className="rounded-xl bg-foreground/[0.04] p-5 text-center text-sm text-muted-foreground">
                No matching Canvas assignments. You can still add your own above.
              </p>
            ) : (
              <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {candidates.map((assignment) => {
                  const item = canvasItem(assignment);
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <li key={assignment.id}>
                      <button
                        type="button"
                        disabled={isSelected}
                        onClick={() => {
                          setSelected((items) => [...items, item]);
                          void studySelectionFeedback();
                        }}
                        className="glass-inset glass-hover flex min-h-14 w-full items-center gap-3 rounded-xl p-3 text-left disabled:opacity-50"
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                            isSelected && "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          {isSelected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {assignment.name}
                          </span>
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
                        className="ml-11 mt-1"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        </div>

        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <GlassCard
            strong
            title="2 · Set the timer"
            subtitle={`${selected.length} ${selected.length === 1 ? "task" : "tasks"} in this session`}
          >
            {selected.length === 0 ? (
              <p className="rounded-xl bg-foreground/[0.04] p-5 text-center text-sm text-muted-foreground">
                Nothing chosen yet. Pick an assignment from the list to begin.
              </p>
            ) : (
              <ol className="space-y-2">
                {selected.map((item, index) => (
                  <li
                    key={item.id}
                    className="glass-inset flex min-h-12 items-center gap-2 rounded-xl px-3"
                  >
                    <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
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
                      className="press rounded-lg p-2 disabled:opacity-25"
                      aria-label={`Move ${item.name} up`}
                    >
                      <ArrowUp className="h-4 w-4" />
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
                      className="press rounded-lg p-2 disabled:opacity-25"
                      aria-label={`Move ${item.name} down`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((items) =>
                          items.filter((candidate) => candidate.id !== item.id),
                        )
                      }
                      className="press rounded-lg p-2 text-destructive"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-5">
              <div className="mb-3 rounded-2xl bg-foreground/[0.05] px-4 py-5 text-center">
                <span className="block text-4xl font-semibold tabular-nums tracking-tight">
                  {duration}
                </span>
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  minutes
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((minutes) => (
                  <Button
                    key={minutes}
                    type="button"
                    variant={duration === minutes ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDuration(minutes)}
                  >
                    {minutes}m
                  </Button>
                ))}
              </div>
              <label className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Custom length</span>
                <Input
                  type="number"
                  min={1}
                  max={480}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="w-24"
                  aria-label="Custom session minutes"
                />
              </label>
            </div>
            <Button
              className="mt-5 min-h-12 w-full disabled:bg-foreground/10 disabled:text-muted-foreground disabled:opacity-100"
              size="lg"
              disabled={!selected.length || !Number.isFinite(duration) || duration < 1}
              onClick={start}
            >
              <TimerReset /> Start session
            </Button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
