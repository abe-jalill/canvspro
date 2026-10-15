import { createFileRoute } from "@tanstack/react-router";
import {
  formatDay,
  graceReminderDue,
  PLANS,
  renewalReminderDue,
  trialReminderDue,
  type Plan,
  type ReminderRow,
} from "@/lib/billing";

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

type Row = ReminderRow & { user_id: string; grace_reminder_sent_at: string | null };

const LIVE = new Set(["trialing", "active", "past_due"]);
// Emails show dates the way most CoursePro students read them.
const TIME_ZONE = "America/New_York";

function priceLabel(plan: Plan | null): string {
  const value = PLANS[plan ?? "monthly"];
  return `${value.price}/${value.per}`;
}

/**
 * Hourly (pg_cron canvaspro-billing-reminders): a reminder 7 days before a
 * trial's first charge, 30 days before a yearly renewal, and 3 days before an
 * older account's free days end. Each is sent once, marked on the row.
 */
async function run(): Promise<Response> {
  const { billingDb, saveBillingRow, readEnforceFrom, graceEndsAt } =
    await import("@/lib/billing.server");
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = await billingDb();
  const now = Date.now();
  let sent = 0;
  let failed = 0;

  const emailOf = async (userId: string): Promise<string | null> => {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  };
  const send = async (userId: string, kind: string, data: Record<string, string>, key: string) => {
    const email = await emailOf(userId);
    if (!email) return false;
    try {
      await sendTemplateEmail("billing-reminder", email, {
        templateData: { kind, appUrl: "https://canvaspro.app", ...data },
        idempotencyKey: key,
      });
      sent++;
      return true;
    } catch (err) {
      failed++;
      console.error("[billing-reminders] send failed", kind, err);
      return false;
    }
  };

  const { data: rows, error } = await db
    .from("billing_accounts")
    .select(
      "user_id,status,plan,trial_ends_at,current_period_end,cancel_at,trial_reminder_sent_at,renewal_reminder_for,grace_reminder_sent_at",
    )
    .in("status", ["trialing", "active"]);
  if (error) throw new Error(error.message);

  for (const row of (rows ?? []) as Row[]) {
    if (trialReminderDue(row, now)) {
      const date = formatDay(row.trial_ends_at, TIME_ZONE);
      if (
        await send(
          row.user_id,
          "trial",
          { date, price: priceLabel(row.plan) },
          `trial-${row.user_id}-${row.trial_ends_at}`,
        )
      ) {
        await saveBillingRow(row.user_id, { trial_reminder_sent_at: new Date().toISOString() });
      }
    } else if (renewalReminderDue(row, now)) {
      const date = formatDay(row.current_period_end, TIME_ZONE);
      if (
        await send(
          row.user_id,
          "renewal",
          { date, price: priceLabel("yearly") },
          `renewal-${row.user_id}-${row.current_period_end}`,
        )
      ) {
        await saveBillingRow(row.user_id, { renewal_reminder_for: row.current_period_end });
      }
    }
  }

  // Accounts from before launch, three days before their free days end.
  const enforceFrom = await readEnforceFrom();
  const launch = enforceFrom ? Date.parse(enforceFrom) : NaN;
  if (Number.isFinite(launch) && now >= launch) {
    const known = new Map<string, Row>();
    const { data: all } = await db
      .from("billing_accounts")
      .select("user_id,status,grace_reminder_sent_at");
    for (const row of (all ?? []) as Row[]) known.set(row.user_id, row);
    for (let page = 1; page <= 100; page++) {
      const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (listError) throw new Error(listError.message);
      for (const user of data.users) {
        const ends = graceEndsAt(user.created_at, enforceFrom);
        const row = known.get(user.id);
        if (
          ends &&
          graceReminderDue({
            graceEndsAt: ends,
            sentAt: row?.grace_reminder_sent_at ?? null,
            subscribed: Boolean(row?.status && LIVE.has(row.status)),
            now,
          })
        ) {
          const date = formatDay(ends, TIME_ZONE);
          if (
            await send(
              user.id,
              "grace",
              { date, price: `${PLANS.monthly.price}/month` },
              `grace-${user.id}`,
            )
          ) {
            await saveBillingRow(user.id, { grace_reminder_sent_at: new Date().toISOString() });
          }
        }
      }
      if (data.users.length < 1000) break;
    }
  }

  return Response.json({ ok: failed === 0, sent, failed });
}

export const Route = createFileRoute("/api/public/billing/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const provided = request.headers.get("x-cron-secret") ?? "";
        const { data } = await supabaseAdmin
          .from("push_cron_config")
          .select("secret")
          .limit(1)
          .maybeSingle();
        const expected = (data?.secret ?? "") as string;
        if (!expected || !constantTimeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          return await run();
        } catch (err) {
          console.error("[billing-reminders] failed", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
