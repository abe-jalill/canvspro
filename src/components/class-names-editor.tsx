import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCoursesFn, type CourseSummary } from "@/lib/canvas.functions";
import { useCanvasKey } from "@/lib/user-settings";
import {
  useNicknames,
  useSaveNicknames,
  type ClassNickname,
} from "@/lib/nicknames";
import { nicknameLookupVersion } from "@/lib/course-display";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { successHaptic } from "@/lib/native";

const coursesQuery = {
  queryKey: ["canvas", "courses"] as const,
  queryFn: getCoursesFn,
};

interface EditorProps {
  courses: CourseSummary[];
  nicknames: ClassNickname[];
  ctaLabel?: string;
  onSaved?: () => void;
}

/** Mobile-first list of raw Canvas names with an editable custom name each. */
export function ClassNamesEditor({
  courses,
  nicknames,
  ctaLabel = "Save names",
  onSaved,
}: EditorProps) {
  const save = useSaveNicknames();
  const [values, setValues] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<number, string> = {};
    courses.forEach((c) => {
      next[c.id] =
        nicknames.find((n) => n.canvas_course_id === c.id)?.custom_name ?? "";
    });
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses.map((c) => c.id).join(","), nicknames.length]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      await save.mutateAsync(
        courses.map((c) => ({
          canvas_course_id: c.id,
          raw_name: c.name,
          raw_code: c.course_code,
          custom_name: values[c.id] ?? "",
        })),
      );
      setStatus("Class names saved.");
      void successHaptic();
      onSaved?.();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save names.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-3">
        {courses.map((c) => (
          <div key={c.id} className="glass-inset flex flex-col gap-2 rounded-xl p-3">
            <div className="min-w-0">
              <p className="break-words text-xs uppercase tracking-wide text-muted-foreground">
                Canvas name
              </p>
              <p className="break-words text-sm font-medium">{c.name}</p>
            </div>
            <input
              type="text"
              value={values[c.id] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [c.id]: e.target.value }))
              }
              placeholder="Your name for this class (optional)"
              className="glass-inset min-h-11 w-full rounded-xl bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Leave a field blank to keep the original Canvas name.
      </p>
      <button
        type="submit"
        disabled={save.isPending}
        className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto sm:self-start"
      >
        {save.isPending ? "Saving…" : ctaLabel}
      </button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </form>
  );
}

/** Loads courses + nicknames for the Settings page. */
export function ClassNamesSection() {
  const { data: key } = useCanvasKey();
  const nicknames = useNicknames();
  const courses = useQuery({ ...coursesQuery, enabled: !!key });

  if (!key) {
    return (
      <p className="text-sm text-muted-foreground">
        Save your Canvas API key first to load your classes.
      </p>
    );
  }
  if (courses.isLoading || nicknames.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your classes…</p>;
  }
  if (courses.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        {(courses.error as Error).message}
      </p>
    );
  }
  if ((courses.data ?? []).length === 0) {
    return <p className="text-sm text-muted-foreground">No active courses found.</p>;
  }

  return (
    <ClassNamesEditor
      courses={courses.data ?? []}
      nicknames={nicknames.data ?? []}
      ctaLabel="Save names"
    />
  );
}

const NAMING_SEEN_KEY = "class-naming-seen-courses";

/**
 * Shows the "Name your classes" setup screen the first time courses load, and
 * again whenever a new course appears that the user has never been asked about.
 */
export function ClassNamesGate({ children }: { children: ReactNode }) {
  const { data: key } = useCanvasKey();
  const nicknames = useNicknames();
  const courses = useQuery({ ...coursesQuery, enabled: !!key });
  const seen = useUserPreferenceKey<string[]>(NAMING_SEEN_KEY, []);
  const [skipped, setSkipped] = useState(false);

  const missing = useMemo(() => {
    const list = courses.data ?? [];
    const named = new Set((nicknames.data ?? []).map((n) => n.canvas_course_id));
    const acknowledged = new Set(seen.value ?? []);
    return list.filter(
      (c) => !named.has(c.id) && !acknowledged.has(String(c.id)),
    );
  }, [courses.data, nicknames.data, seen.value]);

  const dismiss = () => {
    const ids = (courses.data ?? []).map((c) => String(c.id));
    const merged = Array.from(new Set([...(seen.value ?? []), ...ids]));
    seen.set(merged);
    setSkipped(true);
  };

  const ready =
    !key || (!nicknames.isLoading && !courses.isLoading && !seen.isLoading);
  const needsSetup =
    !!key && ready && !skipped && (courses.data ?? []).length > 0 && missing.length > 0;

  if (needsSetup) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-2xl items-start pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="glass-panel-strong w-full min-w-0 p-4 sm:p-5 md:p-7">
          <h1 className="text-2xl font-semibold tracking-tight">Name your classes</h1>
          <p className="mt-1 mb-5 break-words text-sm leading-relaxed text-muted-foreground">
            Give each Canvas course a friendlier name. You can change these later in
            Settings.
          </p>
          <ClassNamesEditor
            courses={courses.data ?? []}
            nicknames={nicknames.data ?? []}
            ctaLabel="Save and continue"
            onSaved={dismiss}
          />
          <button
            type="button"
            onClick={dismiss}
            className="glass-hover mt-3 min-h-11 rounded-xl px-3 text-sm text-muted-foreground"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // Remount the subtree when nicknames change so every display call site
  // re-renders with the new names.
  return <div key={nicknameLookupVersion()}>{children}</div>;
}
