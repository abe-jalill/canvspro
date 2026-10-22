import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsQueryOptions, coursesQueryOptions } from "@/lib/canvas.queries";
import { useCustomAssignments } from "@/lib/custom-assignments";
import { mergeAssignments } from "@/lib/assignment-sources";

/** Assignment surfaces share Canvas + class work. Personal tasks stay in To-Do. */
export function useClassAssignments() {
  const query = useQuery(assignmentsQueryOptions);
  const courses = useQuery(coursesQueryOptions);
  const custom = useCustomAssignments();
  const data = useMemo(() => query.data
    ? mergeAssignments(query.data, custom.list, courses.data ?? [])
    : undefined, [query.data, custom.list, courses.data]);
  return { ...query, data, isLoading: query.isLoading || courses.isLoading || custom.isLoading };
}
