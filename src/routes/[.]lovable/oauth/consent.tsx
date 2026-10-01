// Authorization screen for AI assistants (MCP clients) connecting to CanvasPro.
// Supabase's OAuth server redirects here with an `authorization_id`; this page
// shows who is asking, then approves or denies on the signed-in user's behalf.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth-ui";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Authorize access — CanvasPro" },
      {
        name: "description",
        content: "Review and approve an app's request to read your CanvasPro classes.",
      },
      { property: "og:title", content: "Authorize access — CanvasPro" },
      {
        property: "og:description",
        content: "Review and approve an app's request to read your CanvasPro classes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConsentPage,
});

const AUTH_BASE = `${import.meta.env['VITE_SUPABASE_URL']}/auth/v1`;
const API_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string;

interface AuthorizationDetails {
  authorization_id: string;
  redirect_uri: string;
  client: { id: string; name?: string | null };
  user: { id: string; email?: string | null };
  scope?: string | null;
}

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm who you are",
  email: "See your email address",
  profile: "See your name and profile details",
  offline_access: "Stay connected until you disconnect it",
};

function ConsentPage() {
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);

  const authorizationId = new URLSearchParams(window.location.search).get("authorization_id");

  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        const back = `${window.location.pathname}${window.location.search}`;
        window.location.replace(`/auth?redirect=${encodeURIComponent(back)}`);
        return null;
      }
      const response = await fetch(`${AUTH_BASE}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          apikey: API_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const body = (await response.json().catch(() => null)) as { msg?: string } | null;
      if (!response.ok) {
        throw new Error(body?.msg ?? "This request could not be completed.");
      }
      return body;
    },
    [],
  );

  useEffect(() => {
    if (!authorizationId) {
      setError("This link is missing its request details. Start the connection again from the app.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const body = await request(`/oauth/authorizations/${authorizationId}`);
        if (!body || cancelled) return;
        // Already approved for this app: Supabase hands back the return URL directly.
        const preApproved = (body as { redirect_url?: string }).redirect_url;
        if (preApproved) {
          window.location.replace(preApproved);
          return;
        }
        setDetails(body as unknown as AuthorizationDetails);

      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "This request has expired. Start the connection again from the app.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorizationId, request]);

  async function decide(action: "approve" | "deny") {
    if (!authorizationId) return;
    setBusy(action);
    setError(null);
    try {
      const body = await request(`/oauth/authorizations/${authorizationId}/consent`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const redirect = (body as { redirect_url?: string } | null)?.redirect_url;
      if (redirect) {
        window.location.replace(redirect);
        return;
      }
      setError("The app didn't give us anywhere to send you back to.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const clientName = details?.client?.name?.trim() || "An app";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <AuthShell
      title="Authorize access"
      subtitle={
        details
          ? `${clientName} wants to read your CanvasPro classes`
          : "Checking this request…"
      }
    >
      {error && (
        <p role="alert" className="text-sm text-foreground/80">
          {error}
        </p>
      )}

      {details && !error && (
        <div className="flex w-full flex-col gap-5">
          <div className="glass-inset rounded-xl p-4 text-sm">
            <p className="font-medium text-foreground">{clientName} will be able to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>See your classes and current grades</li>
              <li>See your assignments, due dates, and what you've turned in</li>
              <li>See announcements from your instructors and your calendar events</li>
              {scopes
                .filter((s) => SCOPE_LABELS[s])
                .map((s) => (
                  <li key={s}>{SCOPE_LABELS[s]}</li>
                ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              It can only read. It can't change anything in Canvas or in CanvasPro, and it can't
              see your Canvas API key.
            </p>
          </div>

          {details.user?.email && (
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="text-foreground">{details.user.email}</span>
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => decide("approve")}
              disabled={busy !== null}
              className="glass-hover min-h-12 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
            >
              {busy === "approve" ? "Connecting…" : "Allow access"}
            </button>
            <button
              type="button"
              onClick={() => decide("deny")}
              disabled={busy !== null}
              className="glass-hover glass-inset min-h-12 w-full rounded-xl px-4 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              {busy === "deny" ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
