import { useCallback, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";

/** Stable slug used for per-class anchors so notifications can deep link. */
export function courseSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function courseAnchorId(name: string): string {
  return `course-${courseSlug(name)}`;
}

/** Parses ?course= and returns props for the matching class section. */
export function useCourseHighlight() {
  const search = useSearch({ strict: false }) as { course?: string };
  const target = search.course ? courseSlug(search.course) : null;
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setActive(null);
      return;
    }
    setActive(target);
    const scroll = window.setTimeout(() => {
      document
        .getElementById(`course-${target}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    const clear = window.setTimeout(() => setActive(null), 3200);
    return () => {
      window.clearTimeout(scroll);
      window.clearTimeout(clear);
    };
  }, [target]);

  return useCallback(
    (name: string) => ({
      id: courseAnchorId(name),
      className: active && active === courseSlug(name) ? "course-highlight" : undefined,
    }),
    [active],
  );
}

/** Search-param validator shared by pages that support class deep links. */
export function validateCourseSearch(search: { course?: unknown } | undefined) {
  return {
    course: typeof search?.course === "string" ? search.course : undefined,
  };
}
