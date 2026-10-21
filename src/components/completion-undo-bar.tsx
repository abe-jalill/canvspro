import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import {
  COMPLETION_UNDO_MS,
  dismissCompletionUndo,
  useCompletionUndo,
  type CompletionUndo,
} from "@/lib/completion-motion";
import { cn } from "@/lib/utils";

/**
 * "Marked complete" with a large Undo, at the bottom of every signed-in page.
 * It stays up for seven seconds (longer while the pointer is on it), and
 * Ctrl/⌘ Z undoes too.
 */
export function CompletionUndoBar() {
  const entry = useCompletionUndo();
  // Keeps the last entry on screen while the bar slides away.
  const [shown, setShown] = useState<CompletionUndo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (entry) {
      setShown(entry);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setShown(null), 220);
    return () => window.clearTimeout(timer);
  }, [entry]);

  if (!shown) return null;
  return <UndoBar key={shown.key} entry={shown} visible={visible && entry?.key === shown.key} />;
}

function UndoBar({ entry, visible }: { entry: CompletionUndo; visible: boolean }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(COMPLETION_UNDO_MS);
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => dismissCompletionUndo(entry.key), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, entry.key]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.shiftKey)
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function undo() {
    entry.undo();
    dismissCompletionUndo(entry.key);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      aria-live="polite"
    >
      <div
        role="status"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => {
          setPaused(false);
          setProgressKey((key) => key + 1);
        }}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className={cn(
          "completion-undo-bar pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-2xl bg-foreground py-2.5 pl-3 pr-2 text-background shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/15">
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-tight">
          <span className="block font-medium">Marked complete</span>
          <span className="block break-words text-xs opacity-70">{entry.name}</span>
        </p>
        <button
          type="button"
          onClick={undo}
          className="press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-background px-4 text-sm font-medium text-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/60"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Undo
        </button>
        <button
          type="button"
          onClick={() => dismissCompletionUndo(entry.key)}
          aria-label="Dismiss"
          className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        {/* Time left to undo. */}
        <span
          key={progressKey}
          aria-hidden="true"
          className="completion-undo-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-background/40"
          style={{
            animationDuration: `${remaining.current}ms`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      </div>
    </div>
  );
}
