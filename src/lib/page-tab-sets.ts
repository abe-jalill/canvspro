export interface PageTab {
  to: "/schedule" | "/class-schedule" | "/study-session" | "/get-it-done";
  label: string;
}

export const CALENDAR_TABS: PageTab[] = [
  { to: "/schedule", label: "Calendar" },
  { to: "/class-schedule", label: "My classes" },
];

export const STUDY_TABS: PageTab[] = [
  { to: "/get-it-done", label: "Get It Done" },
  { to: "/study-session", label: "Study Session" },
];
