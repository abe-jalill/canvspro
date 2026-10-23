import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Plus } from "lucide-react";
import "./google-calendar.css";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CalendarEntry } from "@/lib/calendar-agenda";
import {
  CALENDAR_VIEWS,
  HOUR_HEIGHT,
  hourLabel,
  layoutDay,
  monthGrid,
  sameDay,
  shortTime,
  shortViewTitle,
  startOfDay,
  stepAnchor,
  timeRange,
  timeZoneLabel,
  viewDays,
  viewTitle,
  type CalendarView,
} from "@/lib/calendar-grid";

export interface CalendarSourceInfo {
  id: string;
  label: string;
  color: string;
}

const VIEW_KEY = "cp:calendar-view";

function readView(): CalendarView {
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "day" || saved === "week" || saved === "month" || saved === "schedule")
      return saved;
  } catch {
    /* storage unavailable */
  }
  // Phones start on Day, where seven columns would be too narrow.
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
    ? "day"
    : "week";
}

/**
 * The Calendar, laid out like Google Calendar: Today and the arrows with the
 * month at the top, a view switcher, Create with a small month and your
 * calendars on the side, and the hour grid (or month, or schedule) on a sheet.
 */
export function GoogleCalendar({
  now,
  loading,
  error,
  entriesFor,
  colorOf,
  calendars,
  hidden,
  onToggleCalendar,
  onCreate,
  renderCard,
}: {
  now: number;
  loading: boolean;
  error: Error | null;
  /** What's on a day, with hidden calendars already left out. */
  entriesFor: (day: Date) => CalendarEntry[];
  colorOf: (entry: CalendarEntry) => string;
  calendars: CalendarSourceInfo[];
  hidden: Set<string>;
  onToggleCalendar: (id: string) => void;
  /** New event: the day, and the time when a slot in the grid was clicked. */
  onCreate: (day: Date, minutes?: number) => void;
  /** The card that opens on an entry. */
  renderCard: (entry: CalendarEntry, close: () => void) => ReactNode;
}) {
  const today = startOfDay(now);
  const [view, setViewState] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(today);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setViewState(readView()), []);
  const setView = (next: CalendarView) => {
    setViewState(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };
  const go = (direction: 1 | -1) => setAnchor((a) => stepAnchor(view, a, direction));
  const goToday = () => setAnchor(today);
  const openDay = (day: Date) => {
    setAnchor(day);
    setView("day");
  };

  // Google Calendar's keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]"))
        return;
      const key = e.key.toLowerCase();
      if (key === "t") goToday();
      else if (key === "j" || key === "n") go(1);
      else if (key === "k" || key === "p") go(-1);
      else if (key === "d") setView("day");
      else if (key === "w") setView("week");
      else if (key === "m") setView("month");
      else if (key === "a") setView("schedule");
      else if (key === "c") onCreate(anchor);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const days = viewDays(view, anchor);
  const title = viewTitle(view, anchor);

  const entryButton = (entry: CalendarEntry, trigger: ReactNode) => (
    <Popover
      key={entry.key}
      open={openKey === entry.key}
      onOpenChange={(open) => setOpenKey(open ? entry.key : null)}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        collisionPadding={16}
        className="gcal w-[min(26rem,calc(100vw-2rem))] rounded-[28px] border-0 bg-[var(--gc-card)] p-0 text-[var(--gc-text)] shadow-[var(--gc-card-shadow)]"
      >
        {renderCard(entry, () => setOpenKey(null))}
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="gcal relative -mx-3 flex h-[calc(100svh-7.5rem)] min-h-[34rem] flex-col overflow-hidden sm:mx-0 sm:rounded-[28px] md:h-[calc(100svh-7rem)]">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-1 px-2 sm:gap-2 sm:px-4">
        <div className="hidden w-[15.5rem] shrink-0 items-center gap-2.5 pl-2 lg:flex">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gc-primary)] text-[15px] font-medium text-[var(--gc-on-primary)]"
          >
            {today.getDate()}
          </span>
          <span className="text-[22px] text-[var(--gc-muted)]">Calendar</span>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="h-9 shrink-0 rounded-full border border-[var(--gc-faint)] px-4 text-sm font-medium text-[var(--gc-text)] transition-colors hover:bg-[var(--gc-hover)]"
          title={today.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        >
          Today
        </button>
        <div className="flex shrink-0 items-center">
          <IconButton
            label={`Previous ${view === "schedule" ? "period" : view}`}
            onClick={() => go(-1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <IconButton label={`Next ${view === "schedule" ? "period" : view}`} onClick={() => go(1)}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>
        <h1
          className="min-w-0 truncate text-lg font-normal text-[var(--gc-text)] sm:text-[22px]"
          aria-live="polite"
        >
          <span className="hidden sm:inline">{title}</span>
          <span className="sm:hidden">{shortViewTitle(view, anchor)}</span>
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--gc-faint)] pl-4 pr-3 text-sm font-medium text-[var(--gc-text)] transition-colors hover:bg-[var(--gc-hover)]"
              >
                {CALENDAR_VIEWS.find((v) => v.id === view)?.label}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="gcal min-w-44 rounded-[4px] border-0 bg-[var(--gc-sheet)] py-2 text-[var(--gc-text)] shadow-[var(--gc-card-shadow)]"
            >
              {CALENDAR_VIEWS.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  onSelect={() => setView(option.id)}
                  className={cn(
                    "flex h-10 cursor-pointer items-center justify-between rounded-none px-4 text-sm focus:bg-[var(--gc-hover)]",
                    option.id === view && "bg-[var(--gc-hover)]",
                  )}
                >
                  {option.label}
                  <span className="text-xs text-[var(--gc-faint)]">{option.key}</span>
                </DropdownMenuItem>
              ))}
              {/* On phones the side panel (and its link) is hidden. */}
              <DropdownMenuSeparator className="bg-[var(--gc-line)] lg:hidden" />
              <DropdownMenuItem
                asChild
                className="h-10 cursor-pointer rounded-none px-4 text-sm focus:bg-[var(--gc-hover)] lg:hidden"
              >
                <Link to="/class-schedule">Edit class times</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Side panel */}
        <aside className="hidden w-64 shrink-0 flex-col gap-5 overflow-y-auto px-2 pb-4 pt-2 lg:flex gcal-scroll">
          <button
            type="button"
            onClick={() => onCreate(anchor)}
            className="ml-2 flex h-14 w-fit items-center gap-3 rounded-2xl bg-[var(--gc-create)] pl-4 pr-6 text-sm font-medium text-[var(--gc-text)] shadow-[var(--gc-create-shadow)] transition-shadow hover:shadow-[var(--gc-card-shadow)]"
          >
            <Plus
              className="h-6 w-6 text-[var(--gc-primary)]"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            Create
          </button>
          <MiniMonth
            today={today}
            anchor={anchor}
            highlight={view === "month" || view === "schedule" ? [] : days}
            onPick={setAnchor}
          />
          <MyCalendars calendars={calendars} hidden={hidden} onToggle={onToggleCalendar} />
        </aside>

        {/* The sheet */}
        <main
          className="relative mb-2 mr-2 flex min-w-0 flex-1 touch-pan-y flex-col overflow-hidden rounded-2xl bg-[var(--gc-sheet)] sm:mb-4 sm:mr-4 lg:ml-0 ml-2 sm:ml-4"
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const start = swipe.current;
            swipe.current = null;
            if (!start) return;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            // A sideways swipe turns the page, like the arrows.
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={() => {
            swipe.current = null;
          }}
        >
          {error ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-[var(--gc-muted)]">
              <p>Couldn't load your calendar. {error.message}</p>
            </div>
          ) : view === "month" ? (
            <MonthGrid
              anchor={anchor}
              today={today}
              now={now}
              entriesFor={entriesFor}
              colorOf={colorOf}
              entryButton={entryButton}
              onOpenDay={openDay}
              onCreate={onCreate}
            />
          ) : view === "schedule" ? (
            <ScheduleList
              days={days}
              today={today}
              now={now}
              entriesFor={entriesFor}
              colorOf={colorOf}
              entryButton={entryButton}
              onOpenDay={openDay}
            />
          ) : (
            <TimeGrid
              days={days}
              today={today}
              now={now}
              entriesFor={entriesFor}
              colorOf={colorOf}
              entryButton={entryButton}
              onOpenDay={openDay}
              onCreate={onCreate}
            />
          )}
          {loading && (
            <div
              className="absolute inset-x-0 top-0 h-1 overflow-hidden"
              role="status"
              aria-label="Loading your calendar"
            >
              <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--gc-primary)]" />
            </div>
          )}
        </main>
      </div>

      {/* Create, on phones (the side panel is hidden there). */}
      <button
        type="button"
        onClick={() => onCreate(anchor)}
        aria-label="Create event"
        className="absolute bottom-6 right-6 z-20 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--gc-create)] shadow-[var(--gc-card-shadow)] lg:hidden"
      >
        <Plus className="h-7 w-7 text-[var(--gc-primary)]" strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full text-[var(--gc-muted)] transition-colors hover:bg-[var(--gc-hover)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

// MARK: Side panel

function MiniMonth({
  today,
  anchor,
  highlight,
  onPick,
}: {
  today: Date;
  anchor: Date;
  /** The days the main view shows (a week in Week view). */
  highlight: Date[];
  onPick: (day: Date) => void;
}) {
  const [shown, setShown] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  // Follows the main view when it moves to another month.
  useEffect(() => {
    setShown(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  }, [anchor]);
  const weeks = monthGrid(shown);
  const letters = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <section aria-label="Choose a date" className="px-2">
      <div className="flex items-center justify-between pl-2">
        <p className="text-sm font-medium text-[var(--gc-text)]">
          {shown.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <div className="flex">
          <IconButton
            label="Previous month"
            className="h-7 w-7"
            onClick={() => setShown((s) => new Date(s.getFullYear(), s.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Next month"
            className="h-7 w-7"
            onClick={() => setShown((s) => new Date(s.getFullYear(), s.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      <div className="mt-1 grid grid-cols-7 text-center">
        {letters.map((letter, i) => (
          <span
            key={i}
            className="grid h-7 place-items-center text-[11px] font-medium text-[var(--gc-muted)]"
          >
            {letter}
          </span>
        ))}
        {weeks.flat().map((day) => {
          const isToday = sameDay(day, today);
          const isAnchor = sameDay(day, anchor);
          const inView = highlight.some((d) => sameDay(d, day));
          const outside = day.getMonth() !== shown.getMonth();
          return (
            <button
              key={day.getTime()}
              type="button"
              onClick={() => onPick(day)}
              aria-label={day.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              aria-current={isToday ? "date" : undefined}
              className="grid h-7 place-items-center"
            >
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-[11px] font-medium transition-colors",
                  isToday
                    ? "bg-[var(--gc-primary)] text-[var(--gc-on-primary)]"
                    : isAnchor || inView
                      ? "bg-[var(--gc-selected)] text-[var(--gc-on-selected)]"
                      : outside
                        ? "text-[var(--gc-faint)] hover:bg-[var(--gc-hover)]"
                        : "text-[var(--gc-text)] hover:bg-[var(--gc-hover)]",
                )}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MyCalendars({
  calendars,
  hidden,
  onToggle,
}: {
  calendars: CalendarSourceInfo[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="px-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between rounded-full pl-2 pr-2 text-left text-sm font-medium text-[var(--gc-text)] hover:bg-[var(--gc-hover)]"
      >
        My calendars
        <ChevronDown
          className={cn(
            "h-5 w-5 text-[var(--gc-muted)] transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && (
        <ul className="mt-0.5">
          {calendars.map((cal) => {
            const on = !hidden.has(cal.id);
            return (
              <li key={cal.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onToggle(cal.id)}
                  className="flex h-8 w-full items-center gap-3 rounded-full pl-2.5 pr-2 text-left text-sm text-[var(--gc-text)] hover:bg-[var(--gc-hover)]"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[3px] border-2"
                    style={{
                      borderColor: cal.color,
                      backgroundColor: on ? cal.color : "transparent",
                    }}
                  >
                    {on && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                  </span>
                  <span className="min-w-0 truncate">{cal.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to="/class-schedule"
        className="mt-2 flex h-8 items-center rounded-full pl-2.5 text-xs font-medium text-[var(--gc-primary)] hover:bg-[var(--gc-hover)]"
      >
        Edit class times
      </Link>
    </section>
  );
}

// MARK: Day and Week

type EntryButton = (entry: CalendarEntry, trigger: ReactNode) => ReactNode;

function TimeGrid({
  days,
  today,
  now,
  entriesFor,
  colorOf,
  entryButton,
  onOpenDay,
  onCreate,
}: {
  days: Date[];
  today: Date;
  now: number;
  entriesFor: (day: Date) => CalendarEntry[];
  colorOf: (entry: CalendarEntry) => string;
  entryButton: EntryButton;
  onOpenDay: (day: Date) => void;
  onCreate: (day: Date, minutes?: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const perDay = days.map((day) => entriesFor(day));
  const allDay = perDay.map((list) => list.filter((e) => e.allDay));
  const hasAllDay = allDay.some((list) => list.length > 0);
  const showsToday = days.some((d) => sameDay(d, today));
  const columns = `4rem repeat(${days.length}, minmax(0, 1fr))`;
  const nowMinutes = (now - today.getTime()) / 60_000;

  // Opens near now on today's page, else at the start of a school day.
  const firstKey = days[0]?.getTime();
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const hour = showsToday ? Math.max(0, nowMinutes / 60 - 1.5) : 7.5;
    el.scrollTop = hour * HOUR_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, days.length]);

  return (
    <div ref={scroller} className="gcal-scroll min-h-0 flex-1 overflow-y-auto">
      {/* Day headers and all-day items stay at the top while the hours scroll. */}
      <div className="sticky top-0 z-20 bg-[var(--gc-sheet)]">
        <div className="grid" style={{ gridTemplateColumns: columns }}>
          <div className="flex items-end justify-end pb-1 pr-2 text-[10px] text-[var(--gc-muted)]">
            {timeZoneLabel(new Date(now))}
          </div>
          {days.map((day) => {
            const isToday = sameDay(day, today);
            return (
              <div key={day.getTime()} className="flex flex-col items-center pb-2 pt-3">
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-[0.8px]",
                    isToday ? "text-[var(--gc-primary)]" : "text-[var(--gc-muted)]",
                  )}
                >
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={`Open ${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
                  className={cn(
                    "mt-0.5 grid h-[46px] w-[46px] place-items-center rounded-full text-[26px] leading-none transition-colors",
                    isToday
                      ? "bg-[var(--gc-primary)] text-[var(--gc-on-primary)]"
                      : "text-[var(--gc-text)] hover:bg-[var(--gc-hover)]",
                  )}
                >
                  {day.getDate()}
                </button>
              </div>
            );
          })}
        </div>
        {hasAllDay && (
          <div
            className="grid border-b border-[var(--gc-line)]"
            style={{ gridTemplateColumns: columns }}
          >
            <div />
            {allDay.map((list, i) => (
              <div
                key={days[i].getTime()}
                className="space-y-0.5 border-l border-[var(--gc-line)] px-0.5 pb-1"
              >
                {list.map((entry) =>
                  entryButton(
                    entry,
                    <button
                      type="button"
                      className="block w-full truncate rounded-[4px] px-2 py-0.5 text-left text-xs font-medium text-white"
                      style={{ backgroundColor: colorOf(entry) }}
                    >
                      {entry.title}
                    </button>,
                  ),
                )}
              </div>
            ))}
          </div>
        )}
        {!hasAllDay && <div className="h-px bg-[var(--gc-line)]" aria-hidden="true" />}
      </div>

      {/* The hours */}
      <div className="grid" style={{ gridTemplateColumns: columns, height: 24 * HOUR_HEIGHT }}>
        <div className="relative" aria-hidden="true">
          {Array.from({ length: 24 }, (_, h) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[10px] text-[var(--gc-muted)]"
              style={{ top: h * HOUR_HEIGHT }}
            >
              {hourLabel(h)}
            </span>
          ))}
        </div>
        {days.map((day, i) => {
          const isToday = sameDay(day, today);
          const placed = layoutDay(perDay[i], day);
          return (
            <div
              key={day.getTime()}
              className="gcal-hours relative cursor-pointer border-l border-[var(--gc-line)]"
              onClick={(e) => {
                // An empty slot: a new event at that half hour.
                const rect = e.currentTarget.getBoundingClientRect();
                const minutes = Math.floor(((e.clientY - rect.top) / HOUR_HEIGHT) * 2) * 30;
                onCreate(day, Math.min(23 * 60 + 30, Math.max(0, minutes)));
              }}
            >
              {placed.map((p) => {
                const entry = p.entry;
                const top = (p.start / 60) * HOUR_HEIGHT;
                const height = Math.max(18, ((p.end - p.start) / 60) * HOUR_HEIGHT - 2);
                const short = height < 34;
                const past = (entry.end ?? entry.start) < now;
                const width = 100 / p.columns;
                return entryButton(
                  entry,
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute z-[1] overflow-hidden rounded-[4px] px-1.5 text-left text-xs leading-4 text-white shadow-[0_0_0_1px_var(--gc-sheet)] hover:z-[2] focus-visible:z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gc-primary)]",
                      short ? "flex items-center gap-1 py-0" : "py-1",
                      past && "gcal-past",
                    )}
                    style={{
                      top,
                      height,
                      left: `calc(${p.column * width}% + 1px)`,
                      width: `calc(${width}% - ${p.column === p.columns - 1 ? 10 : 3}px)`,
                      backgroundColor: colorOf(entry),
                    }}
                  >
                    {entry.kind === "due" && (
                      <Circle className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    )}
                    {short ? (
                      <span className="truncate">
                        <span className="font-medium">{entry.title}</span>, {shortTime(entry.start)}
                      </span>
                    ) : (
                      <>
                        <span className="line-clamp-2 font-medium">{entry.title}</span>
                        <span className="block truncate">{timeRange(entry.start, entry.end)}</span>
                        {height > 64 && entry.context && (
                          <span className="block truncate">{entry.context}</span>
                        )}
                      </>
                    )}
                  </button>,
                );
              })}
              {isToday && nowMinutes >= 0 && nowMinutes < 24 * 60 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[3]"
                  style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                  aria-hidden="true"
                >
                  <div className="relative h-[2px] bg-[var(--gc-now)]">
                    <span className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-[var(--gc-now)]" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// MARK: Month

function MonthGrid({
  anchor,
  today,
  now,
  entriesFor,
  colorOf,
  entryButton,
  onOpenDay,
  onCreate,
}: {
  anchor: Date;
  today: Date;
  now: number;
  entriesFor: (day: Date) => CalendarEntry[];
  colorOf: (entry: CalendarEntry) => string;
  entryButton: EntryButton;
  onOpenDay: (day: Date) => void;
  onCreate: (day: Date, minutes?: number) => void;
}) {
  const weeks = monthGrid(anchor);
  const shown = weeks.length === 6 ? 2 : 3;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7">
        {weeks[0].map((day) => (
          <span
            key={day.getDay()}
            className="border-l border-[var(--gc-line)] pt-2 text-center text-[11px] font-medium uppercase tracking-[0.8px] text-[var(--gc-muted)] first:border-l-0"
          >
            {day.toLocaleDateString(undefined, { weekday: "short" })}
          </span>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weeks.map((week) => (
          <div
            key={week[0].getTime()}
            className="grid min-h-0 grid-cols-7 border-b border-[var(--gc-line)] last:border-b-0"
          >
            {week.map((day) => {
              const isToday = sameDay(day, today);
              const outside = day.getMonth() !== anchor.getMonth();
              const list = entriesFor(day);
              const visible = list.slice(0, list.length > shown + 1 ? shown : shown + 1);
              const more = list.length - visible.length;
              const label =
                day.getDate() === 1
                  ? day.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : String(day.getDate());
              return (
                <div
                  key={day.getTime()}
                  className="flex min-h-0 cursor-pointer flex-col overflow-hidden border-l border-[var(--gc-line)] px-1 pb-1 first:border-l-0"
                  onClick={() => onCreate(day)}
                >
                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDay(day);
                      }}
                      className={cn(
                        "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-medium transition-colors",
                        isToday
                          ? "bg-[var(--gc-primary)] text-[var(--gc-on-primary)]"
                          : outside
                            ? "text-[var(--gc-faint)] hover:bg-[var(--gc-hover)]"
                            : "text-[var(--gc-text)] hover:bg-[var(--gc-hover)]",
                      )}
                    >
                      {label}
                    </button>
                  </div>
                  <div className="mt-0.5 space-y-px">
                    {visible.map((entry) =>
                      entryButton(
                        entry,
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "flex h-[22px] w-full items-center gap-1.5 rounded-[4px] px-1.5 text-left text-xs",
                            // Phones: a colored bar with the title, as Google's phone app shows a month.
                            "max-sm:h-4 max-sm:gap-0 max-sm:bg-[var(--chip)] max-sm:px-1 max-sm:text-[10px] max-sm:text-white",
                            entry.allDay
                              ? "bg-[var(--chip)] font-medium text-white"
                              : "text-[var(--gc-text)] hover:bg-[var(--gc-hover)]",
                            (entry.end ?? entry.start) < now && !entry.allDay && "opacity-60",
                          )}
                          style={{ "--chip": colorOf(entry) } as CSSProperties}
                        >
                          {!entry.allDay && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-[var(--chip)] max-sm:hidden"
                              aria-hidden="true"
                            />
                          )}
                          {!entry.allDay && (
                            <span className="shrink-0 text-[var(--gc-muted)] max-sm:hidden">
                              {shortTime(entry.start)}
                            </span>
                          )}
                          <span className="truncate font-medium">{entry.title}</span>
                        </button>,
                      ),
                    )}
                    {more > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDay(day);
                        }}
                        className="h-[22px] w-full rounded-[4px] px-1.5 text-left text-xs font-medium text-[var(--gc-text)] hover:bg-[var(--gc-hover)]"
                      >
                        {more} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// MARK: Schedule

function ScheduleList({
  days,
  today,
  now,
  entriesFor,
  colorOf,
  entryButton,
  onOpenDay,
}: {
  days: Date[];
  today: Date;
  now: number;
  entriesFor: (day: Date) => CalendarEntry[];
  colorOf: (entry: CalendarEntry) => string;
  entryButton: EntryButton;
  onOpenDay: (day: Date) => void;
}) {
  const groups = days
    .map((day) => ({ day, entries: entriesFor(day) }))
    .filter((group) => group.entries.length > 0);
  if (groups.length === 0) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <p className="text-sm text-[var(--gc-muted)]">
          Nothing on your calendar for the next 30 days.
        </p>
      </div>
    );
  }
  return (
    <div className="gcal-scroll min-h-0 flex-1 overflow-y-auto py-2">
      {groups.map(({ day, entries }) => {
        const isToday = sameDay(day, today);
        return (
          <section
            key={day.getTime()}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)] border-b border-[var(--gc-line)] px-2 py-2 last:border-b-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:px-4"
          >
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              className="flex h-10 items-center gap-2 self-start text-left"
            >
              <span
                className={cn(
                  "grid h-8 min-w-8 place-items-center rounded-full px-1 text-[22px] leading-none",
                  isToday
                    ? "bg-[var(--gc-primary)] text-[var(--gc-on-primary)]"
                    : "text-[var(--gc-text)]",
                )}
              >
                {day.getDate()}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium uppercase tracking-[0.8px]",
                  isToday ? "text-[var(--gc-primary)]" : "text-[var(--gc-muted)]",
                )}
              >
                {day.toLocaleDateString(undefined, { month: "short" })},{" "}
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
            </button>
            <ul>
              {entries.map((entry) => {
                const past = !entry.allDay && (entry.end ?? entry.start) < now;
                return (
                  <li key={entry.key}>
                    {entryButton(
                      entry,
                      <button
                        type="button"
                        className={cn(
                          "grid min-h-10 w-full grid-cols-[1.5rem_minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-2 rounded-full px-2 text-left text-sm hover:bg-[var(--gc-hover)] max-sm:grid-cols-[1.25rem_minmax(0,1fr)] max-sm:py-1",
                          past && "opacity-60",
                        )}
                      >
                        <span
                          className="h-3 w-3 justify-self-center rounded-full"
                          style={{ backgroundColor: colorOf(entry) }}
                          aria-hidden="true"
                        />
                        <span className="truncate text-[var(--gc-text)] max-sm:hidden">
                          {entry.allDay ? "All day" : timeRange(entry.start, entry.end)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-[var(--gc-text)]">
                            {entry.title}
                          </span>
                          <span className="hidden truncate text-xs text-[var(--gc-muted)] max-sm:block">
                            {entry.allDay ? "All day" : timeRange(entry.start, entry.end)}
                          </span>
                        </span>
                      </button>,
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
