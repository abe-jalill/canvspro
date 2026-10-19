import { Link } from "@tanstack/react-router";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Opens the Completed page: everything finished, most recent first. */
export function CompletedLink({ className }: { className?: string }) {
  return (
    <Link
      to="/completed"
      className={cn(
        "press inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground",
        className,
      )}
    >
      <CheckCheck className="h-4 w-4" aria-hidden="true" />
      Completed
    </Link>
  );
}
