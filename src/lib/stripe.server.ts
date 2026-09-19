import Stripe from 'stripe';

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = 'sandbox' | 'live';

const GATEWAY_STRIPE_BASE = 'https://connector-gateway.lovable.dev/stripe';

// The gateway stores credentials under the base name or, after a
// disconnect/reconnect cycle, under the same name with a `_1` suffix. Both
// may exist; the stale one is rejected with 401 "Credential not found".
function credentialNames(env: StripeEnv): string[] {
  const base = env === 'sandbox' ? 'STRIPE_SANDBOX_API_KEY' : 'STRIPE_LIVE_API_KEY';
  return [base, `${base}_1`];
}

export function getConnectionApiKey(env: StripeEnv): string {
  for (const name of credentialNames(env)) {
    if (process.env[name]) return process.env[name] as string;
  }
  throw new Error(`No Stripe credential configured for ${env}`);
}

export function createStripeClient(env: StripeEnv): Stripe {
  const keys = credentialNames(env)
    .map((name) => process.env[name])
    .filter((k): k is string => !!k);
  if (!keys.length) throw new Error(`No Stripe credential configured for ${env}`);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');

  return new Stripe(keys[0], {
    apiVersion: '2026-03-25.dahlia',
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace('https://api.stripe.com', GATEWAY_STRIPE_BASE);
      const attempt = (key: string) =>
        fetch(gatewayUrl, {
          ...init,
          headers: {
            ...Object.fromEntries(
              new Headers(
                init?.headers ?? (input instanceof Request ? input.headers : undefined),
              ).entries(),
            ),
            'X-Connection-Api-Key': key,
            'Lovable-API-Key': lovableApiKey,
          },
        });

      let res = await attempt(keys[0]);
      if (res.status === 401 && keys.length > 1) {
        const body = await res.clone().text();
        if (body.includes('Credential not found')) {
          res = await attempt(keys[1]);
        }
      }
      return res;
    }),
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const stripeError = error as {
      message?: string;
      type?: string;
      code?: string;
      decline_code?: string;
      param?: string;
      requestId?: string;
      raw?: {
        message?: string;
        type?: string;
        code?: string;
        decline_code?: string;
        param?: string;
        requestId?: string;
      };
    };

    const message = stripeError.raw?.message ?? stripeError.message;
    if (message) {
      const details = [
        stripeError.raw?.type ?? stripeError.type,
        stripeError.raw?.code ?? stripeError.code,
        stripeError.raw?.decline_code ?? stripeError.decline_code,
        stripeError.raw?.param ?? stripeError.param,
        stripeError.raw?.requestId ?? stripeError.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(', ')})` : message;
    }
  }

  return 'Stripe request failed';
}

export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  const secret =
    env === 'sandbox'
      ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
      : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');

  if (!signature || !body) {
    throw new Error('Missing signature or body');
  }

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(',')) {
    const [key, value] = part.split('=', 2);
    if (key === 't') timestamp = value;
    if (key === 'v1') v1Signatures.push(value);
  }

  if (!timestamp || v1Signatures.length === 0) {
    throw new Error('Invalid signature format');
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    throw new Error('Webhook timestamp too old');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Buffer.from(new Uint8Array(signed)).toString('hex');

  if (!v1Signatures.includes(expected)) {
    throw new Error('Invalid webhook signature');
  }

  return JSON.parse(body);
}
