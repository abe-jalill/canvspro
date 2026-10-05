/** Stable endpoints work even when the installed bundle predates the website. */
export async function requestMobileApi<T>(
  path: "sign-in" | "delete-account",
  body: unknown,
  token?: string,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher(`https://canvaspro.app/api/mobile/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.error) {
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "Could not reach CanvasPro. Please try again.",
    );
  }
  return result as T;
}
