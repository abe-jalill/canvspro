export type AssignmentWindow = "7" | "14";

export interface GetItDonePrefs {
  skipped: string[];
  planOrder: string[];
  windowDays: AssignmentWindow;
  planDate: string;
  version: number;
}

export function localPlanDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyGetItDonePrefs(now = new Date()): GetItDonePrefs {
  return {
    skipped: [],
    planOrder: [],
    windowDays: "7",
    planDate: localPlanDateKey(now),
    version: 1,
  };
}

export function normalizeGetItDonePrefs(
  value: Partial<GetItDonePrefs>,
  now = new Date(),
): GetItDonePrefs {
  const today = localPlanDateKey(now);
  const isCurrentPlan = value.planDate === today;
  return {
    // A skip is explicitly "today", and a manual order belongs to that same
    // daily plan. Never carry either into tomorrow (or forever).
    skipped: isCurrentPlan && Array.isArray(value.skipped) ? value.skipped : [],
    planOrder: isCurrentPlan && Array.isArray(value.planOrder) ? value.planOrder : [],
    windowDays: value.windowDays === "14" ? "14" : "7",
    planDate: today,
    version: typeof value.version === "number" ? value.version : 1,
  };
}
