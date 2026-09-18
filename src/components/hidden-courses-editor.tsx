import { useQuery } from "@tanstack/react-query";
import { getAllCoursesIncludingHidden } from "@/lib/canvas.functions";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { useNicknames } from "@/lib/nicknames";

/**
 * Lets each account hide its own courses. Replaces the old hardcoded
 * course-id exclusion list, which applied to every user of the app.
 */
export function HiddenCoursesSection() {
  const { value: hidden, set } = useUserPreferenceKey<number[]>("hidden_course_ids", []);
  const nicknames = useNicknames();
  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses-including-hidden"],
    queryFn: getAllCoursesIncludingHidden,
    staleTime: 5 * 60_000,
  });

  const hiddenSet = new Set(hidden);

  function toggle(id: number) {
    const next = hiddenSet.has(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
    set(next);
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your classes…</p>;
  }

  if (!courses || courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No classes found yet. Save your Canvas API key first.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Untick a class to hide it from your dashboard, grades, assignments, and alerts.
      </p>
      <ul className="flex flex-col gap-2">
        {courses.map((c) => {
          const isHidden = hiddenSet.has(c.id);
          return (
            <li key={c.id}>
              <label className="glass-inset flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 accent-current"
                />
                <span className={isHidden ? "text-muted-foreground line-through" : ""}>
                  {nicknames.nameFor(c.id, c.name)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
