export interface PageTab {
  to: "/schedule" | "/class-schedule";
  label: string;
}

// Today is the dashboard on its own; To-Do has its own sidebar entry, and Get
// It Done is the dashboard's Next up.

export const CALENDAR_TABS: PageTab[] = [
  { to: "/schedule", label: "Calendar" },
  { to: "/class-schedule", label: "My classes" },
];
