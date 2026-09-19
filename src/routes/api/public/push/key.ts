import { createFileRoute } from "@tanstack/react-router";

/**
 * The server's live VAPID public key. Public by design (it is the application
 * server identity browsers subscribe with) and read from the same secret the
 * sender signs with, so a device can never register against a stale key.
 */
export const Route = createFileRoute("/api/public/push/key")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { vapid } = await import("@/lib/vapid.server");
          return Response.json(
            { publicKey: vapid.publicKey },
            { headers: { "cache-control": "no-store" } },
          );
        } catch {
          return Response.json({ error: "push not configured" }, { status: 500 });
        }
      },
    },
  },
});
