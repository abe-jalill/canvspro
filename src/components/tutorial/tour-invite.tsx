import { Link } from "@tanstack/react-router";
import { CirclePlay, X } from "lucide-react";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { TUTORIAL_SEEN_KEY } from "./tutorial-tour";

/**
 * Today offers the tour once. Taking it or closing this hides it on every
 * device; the tour is always in Settings.
 */
export function TourInvite() {
  const seen = useUserPreferenceKey<unknown>(TUTORIAL_SEEN_KEY, null);
  if (!seen.ready || seen.value === true) return null;
  return (
    <div className="glass-panel premium-reveal flex items-center gap-3 rounded-2xl border border-primary/20 p-3 pr-2 sm:p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <CirclePlay className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">New here? Take the one-minute tour</p>
        <p className="text-xs text-muted-foreground">
          See how To-Do, the Calendar and Study fit together.
        </p>
      </div>
      <Link
        to="/settings/tutorial"
        className="press shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Take the tour
      </Link>
      <button
        type="button"
        onClick={() => seen.set(true)}
        aria-label="Hide the tour suggestion"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
