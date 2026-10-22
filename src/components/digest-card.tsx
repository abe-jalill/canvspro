import { AssignmentEstimateEditor } from "@/components/assignment-estimate";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Clock, Sparkles, TrendingUp } from "lucide-react";
import type { AnnouncementItem, AssignmentItem, CourseSummary } from "@/lib/canvas.functions";
import { GlassCard } from "@/components/glass-card";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { displayCourseName } from "@/lib/course-display";
import { getCountdown } from "@/lib/countdown";
import { dueTodayClass, relativeDueDay } from "@/lib/assignment-due";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { isAssignmentComplete } from "@/lib/assignment-window";
import { useUserScope } from "@/lib/user-scope";
import {
  DIGEST_SEEN_KEY,
  digestSnapshot,
  readDigestSeen,
  sameDigest,
  type DigestSeen,
} from "@/lib/digest-seen";
import {
  LAST_COUNTDOWN_KEY,
  LAST_SEEN_GRADES_KEY,
  LAST_VISIT_KEY,
} from "@/lib/local-value";

/** On screen this long counts as seen. */
const SEEN_AFTER_MS = 5_000;

/** What this browser saved before Since your last visit synced, if anything. */
function readLegacyDigest(scope: string | null): DigestSeen | null {
  if (typeof window === "undefined") return null;
  try {
    const key = (base: string) => `cp:${scope ?? "anon"}:${base}`;
    const visit = Number(window.localStorage.getItem(key(LAST_VISIT_KEY)));
    if (!Number.isFinite(visit) || visit <= 0) return null;
    return {
      lastVisit: new Date(visit).toISOString(),
      grades: JSON.parse(window.localStorage.getItem(key(LAST_SEEN_GRADES_KEY)) ?? "{}"),
      urgency: JSON.parse(window.localStorage.getItem(key(LAST_COUNTDOWN_KEY)) ?? "{}"),
    };
  } catch {
    return null;
  }
}

interface Props {
  announcements: AnnouncementItem[];
  assignments: AssignmentItem[];
  courses: CourseSummary[];
}

export function DigestCard({ announcements, assignments, courses }: Props) {
  const seen = useUserPreferenceKey<unknown>(DIGEST_SEEN_KEY, null);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const stored = useMemo(() => readDigestSeen(seen.value), [seen.value]);
  const scope = useUserScope();
  // What counts as new on this visit: the record as it was when the card first
  // showed. Saving this visit (below) doesn't change it, so the student still
  // sees what's new until they leave; the next visit, on any device, starts there.
  const [baseline, setBaseline] = useState<DigestSeen | null>(null);

  const current = useMemo(() => digestSnapshot(assignments, Date.now()), [assignments]);

  useEffect(() => {
    if (!seen.ready || baseline) return;
    // First time on the account: start from what this device saw before
    // syncing existed, or from now, so the card doesn't list everything.
    const start = stored ?? readLegacyDigest(scope) ?? current;
    setBaseline(start);
    if (!stored) seen.set(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen.ready, baseline, stored]);

  const lastVisit = baseline ? Date.parse(baseline.lastVisit) : Number.POSITIVE_INFINITY;

  const newAnnouncements = useMemo(
    () => announcements.filter((a) => new Date(a.posted_at).getTime() > lastVisit).slice(0, 8),
    [announcements, lastVisit],
  );

  const gradeChanges = useMemo(() => {
    const out: Array<{ a: AssignmentItem; prev: number | undefined; next: number }> = [];
    if (!baseline) return out;
    assignments.forEach((a) => {
      const s = a.submission?.score;
      if (typeof s !== "number") return;
      const prev = baseline.grades[String(a.id)];
      if (prev === undefined || prev !== s) {
        out.push({ a, prev, next: s });
      }
    });
    return out.slice(0, 8);
  }, [assignments, baseline]);

  const newlyUrgent = useMemo(() => {
    const out: Array<{ a: AssignmentItem; urgency: string }> = [];
    if (!baseline) return out;
    assignments.forEach((a) => {
      // Finished work isn't urgent, whatever its date says.
      if (isAssignmentComplete(a, completed.has(a.id))) return;
      const cd = getCountdown(a.due_at);
      if (!cd) return;
      if (cd.urgency !== "today" && cd.urgency !== "soon") return;
      if (baseline.urgency[String(a.id)] !== cd.urgency) {
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
  }, [assignments, baseline, completed]);

  const total = newAnnouncements.length + gradeChanges.length + newlyUrgent.length;

  // Seen once it has been on screen a few seconds: saved to the account, so
  // another device doesn't show the same posts and grades again.
  useEffect(() => {
    if (!seen.ready || !baseline) return;
    const newerPost = announcements.some(
      (a) => stored && new Date(a.posted_at).getTime() > Date.parse(stored.lastVisit),
    );
    if (stored && sameDigest(stored, current) && !newerPost) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") seen.set(digestSnapshot(assignments, Date.now()));
    }, SEEN_AFTER_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen.ready, baseline, stored, current, announcements]);

  const markAllSeen = () => {
    const now = digestSnapshot(assignments, Date.now());
    setBaseline(now);
    seen.set(now);
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
              <p className="break-words text-xs font-medium">{a.title}</p>
              <p className="mt-0.5 break-words text-[10px] text-muted-foreground">
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
              <p className="break-words text-xs font-medium">{a.name}</p>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <p className="break-words text-[10px] text-muted-foreground">
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
              <p className="break-words text-xs font-medium">{a.name}</p>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <p className="break-words text-[10px] text-muted-foreground">
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
