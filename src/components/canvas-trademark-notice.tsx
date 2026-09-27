import { cn } from "@/lib/utils";

export function CanvasTrademarkNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn("text-center text-[11px] leading-relaxed text-muted-foreground/75", className)}
    >
      CanvasPro is an independent tool and is not affiliated with, endorsed by, sponsored by, or
      connected in any way to Canvas LMS or Instructure, Inc.
    </p>
  );
}
