import type { LiHTMLAttributes } from "react";
import { useCompletionExit } from "@/lib/completion-motion";

/** A list row that folds away smoothly when its assignment is marked complete. */
export function CompletionRow({
  assignmentId,
  children,
  ...props
}: { assignmentId: string | number } & LiHTMLAttributes<HTMLLIElement>) {
  const { ref } = useCompletionExit<HTMLLIElement>(assignmentId);
  return (
    <li ref={ref} {...props}>
      {children}
    </li>
  );
}
