import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isClassDay, timeRangeLabel, type ClassDay, type ClassSession } from "@/lib/class-schedule";

export const classScheduleQueryKey = ["class-schedule-entries"] as const;

export interface ScheduleEntryInput {
  id?: string;
  code: string;
  section: string;
  title: string;
  crn: string;
  credits: number;
  instructor: string;
  location: string;
  campus: string;
  scheduleType: string;
  days: ClassDay[];
  startMinutes: number;
  endMinutes: number;
  term: string;
  dateRange: string;
}

export async function fetchClassSchedule(): Promise<ClassSession[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("class_schedule_entries")
    .select(
      "id, code, section, title, crn, credits, instructor, location, campus, schedule_type, days, start_minutes, end_minutes, term, date_range",
    )
    .eq("user_id", user.id)
    .order("start_minutes", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    code: r.code ?? "",
    section: r.section ?? "",
    title: r.title,
    displayName: r.title,
    crn: r.crn ?? "",
    credits: Number(r.credits ?? 0),
    instructor: r.instructor ?? "",
    location: r.location ?? "",
    campus: r.campus ?? "",
    scheduleType: r.schedule_type ?? "Lecture",
    days: (r.days ?? []).filter(isClassDay),
    startMinutes: Number(r.start_minutes),
    endMinutes: Number(r.end_minutes),
    timeLabel: timeRangeLabel(Number(r.start_minutes), Number(r.end_minutes)),
    dateRange: r.date_range ?? "",
    term: r.term ?? "",
  }));
}

export function useClassSchedule() {
  return useQuery({
    queryKey: classScheduleQueryKey,
    queryFn: fetchClassSchedule,
    staleTime: 5 * 60_000,
  });
}

/** Replaces the signed-in user's whole schedule with the given rows. */
export function useSaveClassSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ScheduleEntryInput[]) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");

      const keep = rows.filter((r) => r.title.trim().length > 0);
      const savedIds: string[] = [];
      if (keep.length > 0) {
        // Upsert the replacement first. If validation/networking fails, the
        // old schedule remains intact instead of being erased halfway through.
        const { data, error } = await supabase
          .from("class_schedule_entries")
          .upsert(
            keep.map((r) => ({
              ...(r.id && !r.id.startsWith("optimistic-") ? { id: r.id } : {}),
              user_id: user.id,
              code: r.code.trim(),
              section: r.section.trim(),
              title: r.title.trim(),
              crn: r.crn.trim(),
              credits: Number.isFinite(r.credits) ? r.credits : 0,
              instructor: r.instructor.trim(),
              location: r.location.trim(),
              campus: r.campus.trim(),
              schedule_type: r.scheduleType.trim() || "Lecture",
              days: r.days,
              start_minutes: r.startMinutes,
              end_minutes: r.endMinutes,
              term: r.term.trim(),
              date_range: r.dateRange.trim(),
            })),
            { onConflict: "id" },
          )
          .select("id");
        if (error) throw new Error(error.message);
        savedIds.push(...(data ?? []).map((row) => String(row.id)));
      }

      let deleteQuery = supabase.from("class_schedule_entries").delete().eq("user_id", user.id);
      if (savedIds.length > 0) deleteQuery = deleteQuery.not("id", "in", `(${savedIds.join(",")})`);
      const { error: delError } = await deleteQuery;
      if (delError) throw new Error(delError.message);
      return keep.length;
    },
    // Paint the new schedule right away; roll back if the save fails.
    onMutate: async (rows: ScheduleEntryInput[]) => {
      await qc.cancelQueries({ queryKey: classScheduleQueryKey });
      const previous = qc.getQueryData<ClassSession[]>(classScheduleQueryKey);
      const optimistic: ClassSession[] = rows
        .filter((r) => r.title.trim().length > 0)
        .map((r, i) => ({
          id: r.id ?? `optimistic-${i}`,
          code: r.code.trim(),
          section: r.section.trim(),
          title: r.title.trim(),
          displayName: r.title.trim(),
          crn: r.crn.trim(),
          credits: Number.isFinite(r.credits) ? r.credits : 0,
          instructor: r.instructor.trim(),
          location: r.location.trim(),
          campus: r.campus.trim(),
          scheduleType: r.scheduleType.trim() || "Lecture",
          days: r.days,
          startMinutes: r.startMinutes,
          endMinutes: r.endMinutes,
          timeLabel: timeRangeLabel(r.startMinutes, r.endMinutes),
          dateRange: r.dateRange.trim(),
          term: r.term.trim(),
        }))
        .sort((a, b) => a.startMinutes - b.startMinutes);
      qc.setQueryData(classScheduleQueryKey, optimistic);
      return { previous };
    },
    onSuccess: async () => {
      toast.success("Schedule saved");
      await qc.invalidateQueries({ queryKey: classScheduleQueryKey });
    },
    onError: (err: Error, _rows, context) => {
      if (context?.previous) qc.setQueryData(classScheduleQueryKey, context.previous);
      toast.error("Could not save schedule", { description: err.message });
    },
  });
}
