#!/usr/bin/env node
// One-time Paddle setup for CanvasPro: creates the product, its four prices
// (monthly and yearly, each with and without the 14-day trial) and the
// webhook destination, then prints the values to add as Lovable secrets.
//
//   PADDLE_API_KEY=pdl_sdbx_... node scripts/paddle-setup.mjs            (sandbox)
//   PADDLE_API_KEY=pdl_live_... node scripts/paddle-setup.mjs --production
//
// Run it once per environment; running it again creates duplicates.

const production = process.argv.includes("--production");
const taxCategory =
  process.argv.find((arg) => arg.startsWith("--tax-category="))?.split("=")[1] ?? "saas";
const apiKey = process.env.PADDLE_API_KEY;
if (!apiKey) {
  console.error("Set PADDLE_API_KEY (Paddle → Developer tools → Authentication).");
  process.exit(1);
}
const base = production ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

async function paddle(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(
      `${path}: ${json?.error?.detail ?? response.status} ${JSON.stringify(json?.error?.errors ?? "")}`,
    );
  }
  return json.data;
}

const product = await paddle("/products", {
  name: "CanvasPro",
  description:
    "Every Canvas class, assignment, grade and deadline in one dashboard, with reminders.",
  tax_category: taxCategory,
});

const trial = { interval: "day", frequency: 14 };
const prices = {
  PADDLE_PRICE_MONTHLY_TRIAL: {
    name: "Monthly (14-day trial)",
    amount: "500",
    interval: "month",
    trial,
  },
  PADDLE_PRICE_YEARLY_TRIAL: {
    name: "Yearly (14-day trial)",
    amount: "5000",
    interval: "year",
    trial,
  },
  PADDLE_PRICE_MONTHLY: { name: "Monthly", amount: "500", interval: "month" },
  PADDLE_PRICE_YEARLY: { name: "Yearly", amount: "5000", interval: "year" },
};

const ids = {};
for (const [envName, price] of Object.entries(prices)) {
  const created = await paddle("/prices", {
    product_id: product.id,
    name: price.name,
    description: `CanvasPro ${price.name}`,
    unit_price: { amount: price.amount, currency_code: "USD" },
    billing_cycle: { interval: price.interval, frequency: 1 },
    ...(price.trial ? { trial_period: price.trial } : {}),
  });
  ids[envName] = created.id;
}

const destination = await paddle("/notification-settings", {
  description: "CanvasPro subscriptions",
  type: "url",
  destination: "https://canvaspro.app/api/public/paddle/webhook",
  api_version: 1,
  subscribed_events: [
    "subscription.created",
    "subscription.updated",
    "subscription.activated",
    "subscription.trialing",
    "subscription.past_due",
    "subscription.paused",
    "subscription.resumed",
    "subscription.canceled",
  ],
});

console.log(
  `\nPaddle ${production ? "production" : "sandbox"} is set up. Add these in Lovable → Secrets:\n`,
);
console.log(`PADDLE_ENV=${production ? "production" : "sandbox"}`);
console.log(`PADDLE_API_KEY=<the key you used>`);
console.log(`PADDLE_WEBHOOK_SECRET=${destination.endpoint_secret_key}`);
for (const [name, id] of Object.entries(ids)) console.log(`${name}=${id}`);
console.log(`VITE_PADDLE_ENV=${production ? "production" : "sandbox"}`);
console.log(
  "VITE_PADDLE_CLIENT_TOKEN=<Paddle → Developer tools → Authentication → client-side token>",
);
