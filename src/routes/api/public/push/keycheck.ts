import { createFileRoute } from "@tanstack/react-router";

/** TEMPORARY self-test: confirms the stored VAPID pair is a valid matching P-256 keypair. */
export const Route = createFileRoute("/api/public/push/keycheck")({
  server: {
    handlers: {
      GET: async () => {
        const { vapid } = await import("@/lib/vapid.server");
        const b64 = (s: string) => {
          const n = s.replace(/-/g, "+").replace(/_/g, "/");
          const bin = atob(n + "=".repeat((4 - (n.length % 4)) % 4));
          const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          return out;
        };
        const toB64 = (b: Uint8Array) => {
          let s = "";
          for (const x of b) s += String.fromCharCode(x);
          return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        };
        const pub = b64(vapid.publicKey);
        const jwk: JsonWebKey = {
          kty: "EC",
          crv: "P-256",
          d: vapid.privateKey,
          x: toB64(pub.slice(1, 33)),
          y: toB64(pub.slice(33, 65)),
          ext: true,
        };
        try {
          const priv = await crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["sign"],
          );
          const msg = new TextEncoder().encode("vapid-selftest");
          const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, msg);
          const pubKey = await crypto.subtle.importKey(
            "raw",
            pub as unknown as BufferSource,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["verify"],
          );
          const ok = await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            pubKey,
            sig,
            msg,
          );
          return Response.json({ bytes: pub.length, firstByte: pub[0], pairMatches: ok });
        } catch (err) {
          return Response.json({
            bytes: pub.length,
            firstByte: pub[0],
            pairMatches: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    },
  },
});
