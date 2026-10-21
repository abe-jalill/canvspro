import { AssignmentEstimateEditor } from "@/components/assignment-estimate";
import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Clock, Sparkles, TrendingUp } from "lucide-react";
import type { AnnouncementItem, AssignmentItem, CourseSummary } from "@/lib/canvas.functions";
import { GlassCard } from "@/components/glass-card";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { displayCourseName } from "@/lib/course-display";
import { getCountdown } from "@/lib/countdown";
import { dueTodayClass, relativeDueDay } from "@/lib/assignment-due";
import {
  useLocalNumber,
  useLocalNumberMap,
  useLocalStringMap,
  LAST_VISIT_KEY,
  LAST_SEEN_GRADES_KEY,
  LAST_COUNTDOWN_KEY,
} from "@/lib/local-value";

interface Props {
  announcements: AnnouncementItem[];
  assignments: AssignmentItem[];
  courses: CourseSummary[];
}

export function DigestCard({ announcements, assignments, courses }: Props) {
  const lastVisit = useLocalNumber(LAST_VISIT_KEY, 0);
  const seenGrades = useLocalNumberMap(LAST_SEEN_GRADES_KEY);
  const seenCountdowns = useLocalStringMap(LAST_COUNTDOWN_KEY);

  // Snapshot current signals for next visit comparison. We take the snapshot
  // once on first render after data arrives.
  const currentGradeMap = useMemo(() => {
    const m: Record<string, number> = {};
    assignments.forEach((a) => {
      const s = a.submission?.score;
      if (typeof s === "number") m[String(a.id)] = s;
    });
    return m;
  }, [assignments]);

  const currentCountdownMap = useMemo(() => {
    const m: Record<string, string> = {};
    assignments.forEach((a) => {
      const cd = getCountdown(a.due_at);
      if (cd) m[String(a.id)] = cd.urgency;
    });
    return m;
  }, [assignments]);

  const newAnnouncements = useMemo(
    () =>
      announcements.filter((a) => new Date(a.posted_at).getTime() > lastVisit.value).slice(0, 8),
    [announcements, lastVisit.value],
  );

  const gradeChanges = useMemo(() => {
    const out: Array<{ a: AssignmentItem; prev: number | undefined; next: number }> = [];
    assignments.forEach((a) => {
      const s = a.submission?.score;
      if (typeof s !== "number") return;
      const prev = seenGrades.get(a.id);
      if (prev === undefined || prev !== s) {
        out.push({ a, prev, next: s });
      }
    });
    return out.slice(0, 8);
  }, [assignments, seenGrades]);

  const newlyUrgent = useMemo(() => {
    const out: Array<{ a: AssignmentItem; urgency: string }> = [];
    assignments.forEach((a) => {
      const cd = getCountdown(a.due_at);
      if (!cd) return;
      if (cd.urgency !== "today" && cd.urgency !== "soon") return;
      const prev = seenCountdowns.get(a.id);
      if (prev !== cd.urgency) {
        out.push({ a, urgency: cd.urgency });
      }
    });
    // stable-ish sort: today first, then soon, then by daysLeft
    return out
      .sort((x, y) => {
        const rank = (u: string) => (u === "today" ? 0 : 1);
        return rank(x.urgency) - rank(y.urgency);
      })
      .slice(0, 8);
  }, [assignments, seenCountdowns]);

  const total = newAnnouncements.length + gradeChanges.length + newlyUrgent.length;

  // On mount (or when the data landed) treat this as first render of this
  // snapshot — but do NOT immediately mark seen; user should see the digest.
  // Marking seen happens on user action.
  useEffect(() => {
    // Initial-run guard: if this is the very first time, set baselines so
    // the digest doesn't scream about every existing item.
    if (lastVisit.value === 0 && (assignments.length > 0 || announcements.length > 0)) {
      lastVisit.set(Date.now());
      seenGrades.setAll(currentGradeMap);
      seenCountdowns.setAll(currentCountdownMap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments.length, announcements.length]);

  const markAllSeen = () => {
    lastVisit.set(Date.now());
    seenGrades.setAll(currentGradeMap);
    seenCountdowns.setAll(currentCountdownMap);
  };

  const courseName = (id: number, fallbackName?: string, fallbackCode?: string) => {
    const c = courses.find((c) => c.id === id);
    return displayCourseName(c?.name ?? fallbackName, c?.course_code ?? fallbackCode);
  };

  // Only when a new announcement or grade has been posted since the last visit
  // (as on the iPhone); otherwise the card isn't there at all.
  if (newAnnouncements.length + gradeChanges.length === 0) return null;

  return (
    <GlassCard
      title="Since your last visit"
      icon={<Sparkles />}
      subtitle={`${total} update${total === 1 ? "" : "s"}`}
      action={
        <button
          onClick={markAllSeen}
          className="glass-hover rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground"
        >
          Mark all seen
        </button>
      }
    >
      <div className="grid gap-4 md:auto-cols-fr md:grid-flow-col">
        <Section
          icon={<Bell className="h-4 w-4" />}
          label="New announcements"
          count={newAnnouncements.length}
        >
          {newAnnouncements.map((a) => (
            <Link
              key={a.id}
              to="/announcements"
              preload="intent"
              className="glass-inset glass-hover block p-2.5"
            >
              <p className="truncate text-xs font-medium">{a.title}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {courseName(a.course_id, a.course_name, a.course_code)}
              </p>
            </Link>
          ))}
        </Section>

        <Section
          icon={<TrendingUp className="h-4 w-4" />}
          label="New grades"
          count={gradeChanges.length}
        >
          {gradeChanges.map(({ a, prev, next }) => (
            <div key={a.id} className="glass-inset glass-hover block p-2.5">
              <p className="truncate text-xs font-medium">{a.name}</p>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <p className="truncate text-[10px] text-muted-foreground">
                  {courseName(a.course_id, a.course_name, a.course_code)}
                </p>
                <p className="whitespace-nowrap text-[11px] font-semibold tabular-nums">
                  {prev !== undefined ? `${prev} → ${next}` : `${next}`}
                  {a.points_possible ? (
                    <span className="text-muted-foreground"> / {a.points_possible}</span>
                  ) : null}
                </p>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <Link
                  to="/grades"
                  preload="intent"
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  View grade
                </Link>
                <AssignmentDescriptionLink assignmentId={a.id} />
                <AssignmentEstimateEditor assignment={a} />
              </div>
            </div>
          ))}
        </Section>

        <Section
          icon={<Clock className="h-4 w-4" />}
          label="Newly urgent"
          count={newlyUrgent.length}
        >
          {newlyUrgent.map(({ a, urgency }) => (
            <div key={a.id} className={`glass-inset glass-hover block p-2.5 ${dueTodayClass(a.due_at)}`}>
            <Link
              to="/assignments"
              search={{ assignment: String(a.id) }}
              preload="intent"
              className="block"
            >
              <p className="truncate text-xs font-medium">{a.name}</p>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <p className="truncate text-[10px] text-muted-foreground">
                  {courseName(a.course_id, a.course_name, a.course_code)}
                </p>
                <p className="whitespace-nowrap text-[11px] font-semibold">
                  {relativeDueDay(a.due_at) ?? (urgency === "today" ? "Today" : "Due soon")}
                </p>
              </div>
              <span className="mt-1.5 block text-[11px] font-medium text-muted-foreground underline decoration-foreground/20 underline-offset-2">
                See description
              </span>
            </Link>
            <AssignmentEstimateEditor assignment={a} className="mt-2" />
            </div>
          ))}
        </Section>
      </div>
    </GlassCard>
  );
}

/** One part of the digest; a part with nothing in it isn't shown. */
function Section({
  icon,
  label,
  count,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
          {label}
        </h3>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
