import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";

/** Local date + time using the website's calendar and menus. */
export function DueDatePicker({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [datePart, timePart = "23:59"] = value.split("T");
  const selected = datePart ? new Date(`${datePart}T12:00:00`) : undefined;
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={disabled} aria-label="Due date"
            className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-glass-border bg-foreground/[0.03] px-3 py-2 text-left text-sm">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selected ? selected.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Choose a date"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar mode="single" selected={selected} defaultMonth={selected}
            onSelect={(date) => {
              if (!date) return;
              const pad = (n: number) => String(n).padStart(2, "0");
              onChange(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${timePart}`);
              setOpen(false);
            }} />
        </PopoverContent>
      </Popover>
      <TimePicker value={timePart} onChange={(time) => onChange(`${datePart}T${time}`)}
        label="Due time" disabled={disabled} />
    </div>
  );
}
