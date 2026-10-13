/**
 * Which ad or link brought a new account, measured first-party: the campaign
 * tags (UTM) from the first tagged visit stay in this browser until sign-up,
 * then are saved with the account. No third-party trackers, cookies or ad
 * click IDs (gclid, fbclid) are involved.
 */

/** Device-wide (not per-account) so it survives until the visitor signs up. */
export const SIGNUP_SOURCE_KEY = "canvas:signup-source";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
type UtmKey = (typeof UTM_KEYS)[number];

/** A campaign only counts for a sign-up within 30 days of the tagged visit. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LENGTH = 100;

export type SignupSource = Partial<Record<UtmKey, string>> & {
  landing_path: string;
  referrer_host?: string;
  captured_at: string;
};

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The browser's localStorage, or undefined where it is blocked or absent. */
export function browserStorage(): Store | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const text = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_LENGTH);
  return text || undefined;
}

function read(storage: Store, now: Date): SignupSource | null {
  try {
    const raw = storage.getItem(SIGNUP_SOURCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignupSource;
    const age = now.getTime() - Date.parse(parsed?.captured_at);
    if (!(age >= 0 && age <= MAX_AGE_MS)) {
      storage.removeItem(SIGNUP_SOURCE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Remembers the campaign tags of a tagged visit. The first tagged visit wins
 * until it expires, so a later untagged or differently tagged visit does not
 * take the credit. Returns what was saved, or null.
 */
export function captureSignupSource(
  url: URL | string,
  referrer: string,
  storage: Store | undefined,
  now = new Date(),
): SignupSource | null {
  if (!storage) return null;
  let page: URL;
  try {
    page = typeof url === "string" ? new URL(url) : url;
  } catch {
    return null;
  }
  const tags: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const value = clean(page.searchParams.get(key));
    if (value) tags[key] = value;
  }
  if (Object.keys(tags).length === 0 || read(storage, now)) return null;

  let referrerHost: string | undefined;
  try {
    const from = new URL(referrer);
    // Only the site name, never the full address, and not our own pages.
    if (from.hostname !== page.hostname) referrerHost = clean(from.hostname);
  } catch {
    // No referrer, or not a URL.
  }

  const source: SignupSource = {
    ...tags,
    landing_path: clean(page.pathname) ?? "/",
    ...(referrerHost && { referrer_host: referrerHost }),
    captured_at: now.toISOString(),
  };
  try {
    storage.setItem(SIGNUP_SOURCE_KEY, JSON.stringify(source));
  } catch {
    return null;
  }
  return source;
}

/** Sign-up metadata: `{ signup_source }` when a campaign is remembered, else `{}`. */
export function signupSourceMetadata(
  storage: Store | undefined,
  now = new Date(),
): { signup_source?: SignupSource } {
  const source = storage ? read(storage, now) : null;
  return source ? { signup_source: source } : {};
}

/** Once an account carries the campaign, this browser no longer needs it. */
export function clearSignupSource(storage: Store | undefined): void {
  try {
    storage?.removeItem(SIGNUP_SOURCE_KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
}

export type SignupSourceRow = {
  source: string;
  medium: string;
  campaign: string;
  signups: number;
  connected: number;
};

/**
 * Sign-ups per campaign, and how many of them connected Canvas. Metadata is
 * user-editable, so every value is re-cleaned rather than trusted.
 */
export function summarizeSignupSources(
  users: { id: string; signupSource?: unknown }[],
  connectedIds: ReadonlySet<string>,
): SignupSourceRow[] {
  const rows = new Map<string, SignupSourceRow>();
  for (const user of users) {
    const tags = (user.signupSource ?? {}) as Record<string, unknown>;
    const source = clean(tags.utm_source) ?? "direct";
    const medium = clean(tags.utm_medium) ?? "";
    const campaign = clean(tags.utm_campaign) ?? "";
    const key = JSON.stringify([source, medium, campaign]);
    const row = rows.get(key) ?? { source, medium, campaign, signups: 0, connected: 0 };
    row.signups += 1;
    if (connectedIds.has(user.id)) row.connected += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort(
    (a, b) => b.signups - a.signups || a.source.localeCompare(b.source),
  );
}
