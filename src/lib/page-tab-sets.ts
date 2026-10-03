export interface PageTab {
  to: "/dashboard" | "/focus" | "/get-it-done" | "/schedule" | "/class-schedule";
  label: string;
}

export const TODAY_TABS: PageTab[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/focus", label: "Coming Up" },
  { to: "/get-it-done", label: "Get It Done" },
];

export const CALENDAR_TABS: PageTab[] = [
  { to: "/schedule", label: "Calendar" },
  { to: "/class-schedule", label: "My classes" },
];
