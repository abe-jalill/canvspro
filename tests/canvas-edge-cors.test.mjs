import assert from "node:assert/strict";
import test from "node:test";
import { allowedCorsOrigin } from "../supabase/functions/canvas/cors.ts";

test("Canvas Edge Function accepts production, preview, local, and installed iOS origins", () => {
  const accepted = [
    "https://canvaspro.app",
    "https://www.canvaspro.app",
    "https://project--example.lovable.app",
    "https://preview-example.lovableproject.com",
    "http://localhost:8080",
    "http://127.0.0.1:8081",
    "capacitor://localhost",
    "ionic://localhost",
  ];
  for (const origin of accepted) assert.equal(allowedCorsOrigin(origin), origin);
});

test("Canvas Edge Function never reflects an unknown origin", () => {
  assert.equal(allowedCorsOrigin("https://attacker.example"), "https://canvaspro.app");
  assert.equal(allowedCorsOrigin("null"), "https://canvaspro.app");
});
