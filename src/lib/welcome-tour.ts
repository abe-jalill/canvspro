// The first-visit tutorial on the homepage. Whether someone has seen it is a
// per-browser convenience, so every storage call is guarded: private windows
// and blocked storage must never break the page.

const STORAGE_KEY = "canvaspro:welcome-tour-seen";

export function hasSeenWelcomeTour(storage?: Pick<Storage, "getItem">): boolean {
  try {
    const store = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
    return store?.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage is blocked: treat the tour as seen so it never nags on every visit.
    return true;
  }
}

export function markWelcomeTourSeen(storage?: Pick<Storage, "setItem">): void {
  try {
    const store = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
    store?.setItem(STORAGE_KEY, "1");
  } catch {
    // Nothing to do: the tour may show again next visit.
  }
}

export const WELCOME_TOUR_STORAGE_KEY = STORAGE_KEY;
