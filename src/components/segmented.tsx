import { cn } from "@/lib/utils";

interface Option<T extends string> {
  id: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "segmented-control glass-panel-strong inline-flex max-w-full gap-1 overflow-x-auto p-1.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            type="button"
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-xl px-4 py-1.5 text-xs font-medium transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
