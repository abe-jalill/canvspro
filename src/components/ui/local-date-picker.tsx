import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function LocalDatePicker({ value, onChange, label = "Date", min, clearable = false, disabled }: {
  value: string; onChange: (value: string) => void; label?: string; min?: string; clearable?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + "T12:00:00") : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={label}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-glass-border bg-foreground/[0.03] px-3 py-2 text-left text-sm">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          {selected ? selected.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Choose a date"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" selected={selected} defaultMonth={selected}
          disabled={min ? { before: new Date(min + "T00:00:00") } : undefined}
          onSelect={(date) => {
            if (!date) return;
            const pad = (n: number) => String(n).padStart(2, "0");
            onChange(date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()));
            setOpen(false);
          }} />
        {clearable && <button type="button" className="min-h-11 w-full text-sm text-muted-foreground"
          onClick={() => { onChange(""); setOpen(false); }}>Clear date</button>}
      </PopoverContent>
    </Popover>
  );
}
