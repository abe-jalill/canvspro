// Fall 2026 class schedule (static; user-provided).
// Days use single-letter Canvas convention: M Tu W R (Thu) F.

export type ClassDay = "M" | "T" | "W" | "R" | "F";

export interface ClassSession {
  code: string;
  section: string;
  title: string;
  displayName: string;
  crn: string;
  credits: number;
  instructor: string;
  location: string;
  campus: string;
  scheduleType: "Lecture" | "Lab";
  days: ClassDay[];
  startMinutes: number; // minutes from midnight
  endMinutes: number;
  timeLabel: string;
  dateRange: string;
}

const t = (h: number, m: number) => h * 60 + m;

export const CLASS_SCHEDULE: ClassSession[] = [
  {
    code: "BIO 1213",
    section: "04",
    title: "Biology 1",
    displayName: "Biology 1",
    crn: "1230",
    credits: 3,
    instructor: "Aleksandra Kuzmanov",
    location: "Science Building S324",
    campus: "Southfield",
    scheduleType: "Lecture",
    days: ["M", "W"],
    startMinutes: t(12, 30),
    endMinutes: t(13, 45),
    timeLabel: "12:30 – 1:45 PM",
    dateRange: "Aug 24 – Dec 11, 2026",
  },
  {
    code: "BIO 1221",
    section: "02",
    title: "Biology 1 Laboratory",
    displayName: "Biology 1 Lab",
    crn: "1749",
    credits: 1,
    instructor: "Amanda Flack",
    location: "Science Building S305",
    campus: "Southfield",
    scheduleType: "Lab",
    days: ["W"],
    startMinutes: t(14, 0),
    endMinutes: t(16, 50),
    timeLabel: "2:00 – 4:50 PM",
    dateRange: "Aug 24 – Dec 11, 2026",
  },
  {
    code: "BME 1201",
    section: "01",
    title: "BME Computer Graphics Lab",
    displayName: "BME Graphics Lab",
    crn: "1212",
    credits: 1,
    instructor: "Andrew M. Ulaszek",
    location: "Engineering Building E203",
    campus: "Southfield",
    scheduleType: "Lab",
    days: ["M"],
    startMinutes: t(16, 0),
    endMinutes: t(17, 50),
    timeLabel: "4:00 – 5:50 PM",
    dateRange: "Aug 24 – Dec 11, 2026",
  },
  {
    code: "BME 1202",
    section: "01",
    title: "Computer Applications Lab",
    displayName: "Computer Applications",
    crn: "1185",
    credits: 2,
    instructor: "Ge He",
    location: "Engineering Building E211",
    campus: "Southfield",
    scheduleType: "Lab",
    days: ["M", "W"],
    startMinutes: t(9, 30),
    endMinutes: t(10, 45),
    timeLabel: "9:30 – 10:45 AM",
    dateRange: "Aug 24 – Dec 11, 2026",
  },
  {
    code: "EGE 1001",
    section: "01",
    title: "Fundamentals of Engineering Design Projects",
    displayName: "Engineering Design",
    crn: "1041",
    credits: 1,
    instructor: "Andrew Gerhart",
    location: "Engineering Building E109",
    campus: "Southfield",
    scheduleType: "Lab",
    days: ["R"],
    startMinutes: t(10, 0),
    endMinutes: t(11, 50),
    timeLabel: "10:00 – 11:50 AM",
    dateRange: "Aug 24 – Dec 11, 2026",
  },
  {
    code: "HUM 1223",
    section: "03",
    title: "Engaging Modern Texts",
    displayName: "Humanities",
    crn: "1498",
    credits: 3,
    instructor: "Alisa Mullaj",
    location: "Science Building S206",
    campus: "Southfield",
    scheduleType: "Lecture",
    days: ["M", "W"],
    startMinutes: t(11, 0),
    endMinutes: t(12, 15),
    timeLabel: "11:00 AM – 12:15 PM",
    dateRange: "Aug 24 – Dec 11, 2026",
  },
  {
    code: "MCS 1424",
    section: "03",
    title: "Calculus 2",
    displayName: "Calculus 2",
    crn: "1146",
    credits: 4,
    instructor: "Wisam Bukaita",
    location: "Science Building S206",
    campus: "Southfield",
    scheduleType: "Lecture",
    days: ["T", "R"],
    startMinutes: t(14, 0),
    endMinutes: t(15, 50),
    timeLabel: "2:00 – 3:50 PM",
    dateRange: "Aug 24 – Dec 11, 2026",
  },
];

export const TOTAL_CREDITS = CLASS_SCHEDULE.reduce((s, c) => s + c.credits, 0);

export const DAY_LABELS: Record<ClassDay, string> = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  R: "Thursday",
  F: "Friday",
};

export const DAY_ORDER: ClassDay[] = ["M", "T", "W", "R", "F"];

export function sessionsByDay(): Record<ClassDay, ClassSession[]> {
  const out: Record<ClassDay, ClassSession[]> = {
    M: [],
    T: [],
    W: [],
    R: [],
    F: [],
  };
  for (const s of CLASS_SCHEDULE) {
    for (const d of s.days) out[d].push(s);
  }
  for (const d of DAY_ORDER) {
    out[d].sort((a, b) => a.startMinutes - b.startMinutes);
  }
  return out;
}
