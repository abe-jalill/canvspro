## Add hourly notifications + static Class Schedule page

### 1. Hourly assignment-check reminders (9 AM – 9 PM)

Browser notifications only fire while the site is open in a tab. True background push (works when the tab is closed) needs a service worker + push server, which is much bigger scope. This plan does the in-tab version.

- Add a small `useHourlyReminder` hook mounted once in `__root.tsx`.
- On first load, request `Notification.permission` (with a small in-app prompt so it's not jarring).
- Schedule a timer that fires at the top of every hour between 9:00 and 21:00 local time and shows: "Time to check your assignments — N due soon."
- Persist "last shown hour" in `localStorage` so reopening the tab mid-hour doesn't double-fire.
- Add a toggle in the sidebar (bell icon) to enable/disable reminders.

If you want notifications that fire when the browser is closed, say so and I'll add a follow-up plan for a service worker + push subscription (requires a push provider).

### 2. Static "Class Schedule" page

New route `src/routes/class-schedule.tsx` linked in the sidebar (below Schedule), containing the Fall 2026 courses you pasted:

| Course | CRN | Credits | Days | Time | Room | Instructor |
|---|---|---|---|---|---|---|
| BIO 1213-04 Biology 1 | 1230 | 3 | MW | 12:30–1:45 PM | Science S324 | Aleksandra Kuzmanov |
| BIO 1221-02 Biology 1 Lab | 1749 | 1 | W | 2:00–4:50 PM | Science S305 | Amanda Flack |
| BME 1201-01 Computer Graphics Lab | 1212 | 1 | M | 4:00–5:50 PM | Engineering E203 | Andrew Ulaszek |
| BME 1202-01 Computer Applications Lab | 1185 | 2 | MW | 9:30–10:45 AM | Engineering E211 | Ge He |
| EGE 1001-01 Fundamentals of Engineering Design | 1041 | 1 | R (Thu) | 10:00–11:50 AM | Engineering E109 | Andrew Gerhart |
| HUM 1223-03 Engaging Modern Texts | 1498 | 3 | MW | 11:00 AM–12:15 PM | Science S206 | Alisa Mullaj |
| MCS 1424-03 Calculus 2 | 1146 | 4 | TR | 2:00–3:50 PM | Science S206 | Wisam Bukaita |

Total credit hours: **15.000** — displayed as a header stat.

Layout:
- Data lives in `src/lib/class-schedule.ts` (typed array).
- Page shows: header ("Fall 2026 · 15 credits · Aug 24 – Dec 11") and a weekday grid (Mon–Fri columns, time-block cards) plus a list view underneath with full detail (CRN, instructor, room, campus).
- Uses existing Liquid Glass tokens — no design changes.
- Sidebar gets a "Class Schedule" link (calendar-week icon) directly under the existing "Schedule".

### Files touched
- **New**: `src/routes/class-schedule.tsx`, `src/lib/class-schedule.ts`, `src/hooks/use-hourly-reminder.ts`, small `src/components/reminder-toggle.tsx`.
- **Edited**: `src/routes/__root.tsx` (mount hook), `src/components/app-sidebar.tsx` (new link + reminder toggle).

No backend or DB changes.