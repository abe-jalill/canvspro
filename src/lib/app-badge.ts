// App-icon badge (installed PWA / supporting browsers). Silently ignored elsewhere.

interface BadgeNavigator {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

export function badgeSupported(): boolean {
  return typeof navigator !== "undefined" && "setAppBadge" in navigator;
}

export function setAppBadge(count: number): void {
  const nav = navigator as unknown as BadgeNavigator;
  if (!nav.setAppBadge) return;
  const p = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.();
  void p?.catch(() => undefined);
}

export function clearAppBadge(): void {
  const nav = navigator as unknown as BadgeNavigator;
  void nav.clearAppBadge?.().catch(() => undefined);
}
