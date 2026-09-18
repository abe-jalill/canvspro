# Security hardening pass

Six findings, all confirmed in the code. Five need fixes; one is a false alarm.

## 1. The `.env` file (no action needed, will explain)

The file holds only the backend address, the project id, and the *publishable* key — the same value that ships inside the app's JavaScript for every visitor by design. Nothing private is in it, so there is nothing to rotate. It is also regenerated automatically by the platform, so hiding it from version control would just break rebuilds. The real private values (service key, push key, payment keys, Canvas key) are already stored in the encrypted secret store, never in files.

## 2. Push signing key hardcoded — fix

`src/lib/vapid.server.ts` contains the private push key in plain text. A matching secret (`VAPID_PRIVATE_KEY`, plus public key and subject) already exists in the secret store, so the file will read all three from there and throw a clear error if any is missing. The key text is removed from the code.

## 3. Free-Pro email list visible in the browser — fix

`src/lib/subscription.ts` lists two personal email addresses in code that ships to every visitor. Fix: the addresses move to a server-only setting, and the app asks the server "does this account have complimentary access?" instead of comparing emails in the browser. Nothing identifying remains in the shipped code.

## 4. Personal course IDs excluded for everyone — fix

Three course ids (`11452, 3465, 6219`) are filtered out for *every* CanvasPro user, in the Canvas data service and in the background-alerts code. Fix: remove the hardcoded list, and add a per-account "hidden courses" setting saved with the user's other preferences, so anyone (including you) can hide their own courses from the Courses/Grades view.

## 5. Payment webhook silently accepts bad requests — fix

The payment webhook currently answers "OK" when the environment marker on the request is missing or wrong, which means a paid subscription could fail to unlock Pro with no trace. Fix: answer with an error status and log it, so the payment provider retries and the failure is visible.

## 6. Unvalidated return address after checkout — fix

The checkout and billing-portal server functions accept any return address from the browser. Fix: validate it server-side against the app's own known addresses (live site, custom domain, preview, localhost) and reject anything else, so payment can never end on an outside site.

## Technical notes

- `src/lib/vapid.server.ts`: read `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` from `process.env` inside a getter (not at module scope); keep `src/lib/vapid.ts` as the browser-safe public key.
- Comped access: new server fn in `src/lib/entitlements.functions.ts` with `requireSupabaseAuth`, comparing `context.claims.email` against a server-only `COMP_EMAILS` env value; `useSubscription()` calls it instead of the inline array.
- Hidden courses: add `hidden_course_ids` to the existing per-user preferences record; the Canvas edge function and `push-dispatch.server.ts` drop their `EXCLUDED_COURSE_IDS` sets, and filtering happens per user.
- Webhook: invalid/missing `env` query param returns `400` with a `console.error`, instead of `Response.json({ received: true })`.
- Return URL: shared `assertSafeReturnUrl()` used in both `createCheckoutSession` and `createPortalSession` input validators; allowlist of exact origins, `https` only (plus localhost in dev).
