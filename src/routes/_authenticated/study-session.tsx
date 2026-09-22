import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { studySelectionFeedback, studySuccessFeedback } from "@/lib/study-session-feedback";
import { useStudySession } from "@/hooks/use-study-session";
import {
  createStudySession,
  remainingForSession,
  type StudySessionItem,
  type StudySessionSnapshot,
} from "@/lib/study-session";

const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: 5 * 60_000,
});

const PRESETS = [15, 25, 45, 60];

export const Route = createFileRoute("/_authenticated/study-session")({
  head: () => ({ meta: [{ title: "Study Session — Canvas Pro" }] }),
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

function StudySessionPage() {
  const assignments = useQuery(assignmentsQO);
  const { session, setSession, ready } = useStudySession();
  const [selected, setSelected] = useState<StudySessionItem[]>([]);
  const [manualName, setManualName] = useState("");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [duration, setDuration] = useState(25);
  const [now, setNow] = useState(() => Date.now());
  const [summary, setSummary] = useState<StudySessionSnapshot | null>(null);

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

  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (assignments.data ?? [])
      .filter((item) => {
        const submitted =
          Boolean(item.submission?.submitted_at) || item.submission?.workflow_state === "graded";
        if (!showCompleted && submitted) return false;
        if (!needle) return true;
        return `${item.name} ${item.course_name} ${item.course_code}`
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });
  }, [assignments.data, search, showCompleted]);

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
      <div className="mx-auto max-w-3xl space-y-5 pb-24 md:pb-8">
        <header className="px-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Study Session</p>
          <h1 className="mt-1 text-2xl font-normal tracking-tight">
            Stay with the next small step.
          </h1>
        </header>
        <GlassCard strong className="text-center">
          <div className="mx-auto mb-5 h-1.5 max-w-md overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {session.status === "paused" ? "Paused" : "Time remaining"}
          </p>
          <p
            className="mt-1 text-6xl font-light tabular-nums tracking-tight sm:text-7xl"
            aria-label={`${formatTime(remaining)} remaining`}
          >
            {formatTime(remaining)}
          </p>
          <div className="mt-7 rounded-2xl bg-foreground/[0.05] p-5 text-left">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Now studying</p>
            <p className="mt-1 text-lg font-medium">{current.name}</p>
            {current.courseName && (
              <p className="mt-1 text-sm text-muted-foreground">{current.courseName}</p>
            )}
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
              <Check /> Done with this
            </Button>
          </div>
        </GlassCard>

        <GlassCard
          title="Session queue"
          subtitle={`${completed.size} of ${session.items.length} finished`}
        >
          <ol className="space-y-2">
            {session.items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => update({ currentIndex: index })}
                  className={cn(
                    "glass-inset flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left",
                    index === session.currentIndex && "ring-1 ring-primary/50",
                    completed.has(item.id) && "opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                      completed.has(item.id) && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {completed.has(item.id) ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 truncate text-sm",
                      completed.has(item.id) && "line-through",
                    )}
                  >
                    {item.name}
                  </span>
                  {item.source === "manual" && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                      Your task
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
          <Button
            variant="ghost"
            className="mt-4 text-destructive"
            onClick={() => {
              if (window.confirm("End this study session? Your timer progress will be cleared.")) {
                setSummary(session);
                setSession(null);
              }
            }}
          >
            <Trash2 /> End session
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 md:pb-8">
      <header className="px-1">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Study Session</p>
        <h1 className="mt-1 text-2xl font-normal tracking-tight">
          Choose what matters. Give it a finish line.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Pick Canvas assignments or add your own task. Your timer survives refreshes and app
          backgrounding.
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
        <div className="space-y-5">
          <GlassCard
            title="Add your own assignment"
            subtitle="Only the assignment name is required"
          >
            <form
              className="flex gap-2"
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
          </GlassCard>

          <GlassCard title="Canvas assignments" subtitle="Submitted work is hidden by default">
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
            </div>
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
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        </div>

        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <GlassCard
            title="Your session"
            subtitle={`${selected.length} ${selected.length === 1 ? "assignment" : "assignments"}`}
          >
            {selected.length === 0 ? (
              <p className="rounded-xl bg-foreground/[0.04] p-5 text-center text-sm text-muted-foreground">
                Add at least one assignment to begin.
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
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Session length
              </p>
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
              <label className="mt-3 flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Custom</span>
                <Input
                  type="number"
                  min={1}
                  max={480}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="w-24"
                  aria-label="Custom session minutes"
                />
                <span className="text-muted-foreground">minutes</span>
              </label>
            </div>
            <Button
              className="mt-5 min-h-12 w-full"
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
