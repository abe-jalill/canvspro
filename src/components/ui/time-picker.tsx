import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Site-styled controls with minute precision, shared by task and schedule forms. */
export function TimePicker({ value, onChange, label = "Time", className, disabled }: {
  value: string; onChange: (value: string) => void; label?: string;
  className?: string; disabled?: boolean;
}) {
  const [hour = 23, minute = 59] = value ? value.split(":").map(Number) : [];
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  const update = (h: number, m: number, p: string) =>
    onChange(`${String(h % 12 + (p === "PM" ? 12 : 0)).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return (
    <div className={cn("grid min-w-0 grid-cols-[1fr_1fr_1.1fr] gap-1", className)}
      role="group" aria-label={label}>
      <Select disabled={disabled} value={String(displayHour)} onValueChange={(v) => update(Number(v), minute, period)}>
        <SelectTrigger aria-label={`${label}: hour`} className="gap-1 px-2 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{Array.from({ length: 12 }, (_, i) =>
          <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent>
      </Select>
      <Select disabled={disabled} value={String(minute)} onValueChange={(v) => update(displayHour, Number(v), period)}>
        <SelectTrigger aria-label={`${label}: minute`} className="gap-1 px-2 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{Array.from({ length: 60 }, (_, i) =>
          <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}</SelectItem>)}</SelectContent>
      </Select>
      <Select disabled={disabled} value={period} onValueChange={(v) => update(displayHour, minute, v)}>
        <SelectTrigger aria-label={`${label}: AM or PM`} className="gap-1 px-2 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
      </Select>
    </div>
  );
}
