import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Search } from "lucide-react";
import { assignmentsQueryOptions, coursesQueryOptions } from "@/lib/canvas.queries";
import { useLocalSet, COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { isAssignmentComplete } from "@/lib/assignment-window";
import { completionRecords } from "@/lib/completion-records";
import { completedEntries, completedGroupLabel } from "@/lib/completed-list";
import { customToAssignmentItem, useCustomAssignments } from "@/lib/custom-assignments";
import { displayCourseName } from "@/lib/course-display";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { CompleteToggle } from "@/components/complete-toggle";
import { ErrorState } from "@/components/glass-card";
import { SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";

export const Route = createFileRoute("/_authenticated/completed")({
  head: () => ({
    meta: [
      { title: "Completed — CoursePro" },
      { name: "description", content: "Everything you've finished, most recent first." },
    ],
  }),
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(assignmentsQueryOptions);
      void context.queryClient.ensureQueryData(coursesQueryOptions);
    }
  },
  component: CompletedPage,
});

const GROUPS = ["Today", "Yesterday", "This week", "Earlier"] as const;

/** A page of its own (no sidebar), opened from Coming Up and Assignments. */
function CompletedPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const assignments = useQuery(assignmentsQueryOptions);
  const courses = useQuery(coursesQueryOptions);
  const preferences = useUserPreferences();
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const custom = useCustomAssignments();
  const [search, setSearch] = useState("");

  const courseById = useMemo(
    () => new Map((courses.data ?? []).map((course) => [course.id, course])),
    [courses.data],
  );
  const entries = useMemo(() => {
    const all = [
      ...(assignments.data ?? []),
      ...custom.list.map((item) => customToAssignmentItem(item, courseById.get(item.course_id))),
    ];
    return completedEntries(
      all,
      (a) => isAssignmentComplete(a, completed.has(a.id)),
      (id) => completed.has(id),
      completionRecords(preferences.data ?? {}),
    );
  }, [assignments.data, custom.list, courseById, completed, preferences.data]);

  const courseName = (courseId: number, fallback?: string | null, code?: string | null) => {
    const course = courseById.get(courseId);
    return displayCourseName(course?.name ?? fallback ?? "Class", course?.course_code ?? code);
  };
  const query = search.trim().toLowerCase();
  const shown = query
    ? entries.filter(
        ({ assignment: a }) =>
          a.name.toLowerCase().includes(query) ||
          courseName(a.course_id, a.course_name, a.course_code).toLowerCase().includes(query),
      )
    : entries;
  const now = Date.now();
  const groups = GROUPS.map((label) => ({
    label,
    items: shown.filter((entry) => completedGroupLabel(entry.doneAt, now) === label),
  })).filter((group) => group.items.length > 0);

  const goBack = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: "/focus", search: { window: "7" } });
  };
  const loading = assignments.isLoading || completed.isLoading;

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <header className="mb-6 flex items-center gap-3 py-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-foreground transition-colors hover:border-foreground/40"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-medium tracking-tight">Completed</h1>
        {!loading && (
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {entries.length} finished
          </span>
        )}
      </header>

      {loading ? (
        <div className="space-y-3 px-1" role="status" aria-label="Loading finished work">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : assignments.isError && !assignments.data ? (
        <ErrorState message={(assignments.error as Error).message} />
      ) : entries.length === 0 ? (
        <div className="px-1 py-24 text-center">
          <Check className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-base">Nothing finished yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tick off an assignment and it shows up here.
          </p>
        </div>
      ) : (
        <div className="space-y-8 px-1">
          <label className="flex items-center gap-3 rounded-xl border border-foreground/15 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a finished assignment or class"
              aria-label="Search completed assignments"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          {groups.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing finished matches “{search.trim()}”.
            </p>
          )}
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="text-sm text-muted-foreground">
                {group.label}
                <span className="ml-2 tabular-nums opacity-70">{group.items.length}</span>
              </h2>
              <ul className="mt-2 space-y-2">
                {group.items.map(({ assignment: a, doneAt, inCanvas }) => (
                  <li
                    key={a.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3.5 rounded-lg border border-foreground/15 px-4 py-3.5"
                  >
                    <CompleteToggle
                      done
                      onToggle={() => completed.toggle(a.id)}
                      label={a.name}
                      disabled={!completed.ready}
                      className="mt-0.5 h-5 w-5"
                    />
                    <div className="min-w-0">
                      <p className="text-[15px] leading-snug">{a.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {courseName(a.course_id, a.course_name, a.course_code)} ·{" "}
                        {inCanvas ? "Done in Canvas" : "Marked done"}
                      </p>
                    </div>
                    <p className="whitespace-nowrap pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
                      {doneAt != null
                        ? new Intl.DateTimeFormat(undefined, {
                            month: "short",
                            day: "numeric",
                          }).format(doneAt)
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
