import { createStripeClient } from "@/lib/stripe.server";

export async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      const taggedUserId = customer.metadata?.userId;
      // NEVER adopt a customer that already belongs to another account (for
      // example a deleted account that re-registered with the same address):
      // that would hand its billing history and subscriptions to a new user.
      const belongsToSomeoneElse =
        !!taggedUserId && !!options.userId && taggedUserId !== options.userId;
      if (!belongsToSomeoneElse) {
        if (!taggedUserId && options.userId) {
          // Untagged legacy customer: only adopt it when it carries no
          // subscription that could leak entitlement.
          const subs = await stripe.subscriptions.list({
            customer: customer.id,
            status: "all",
            limit: 1,
          });
          if (subs.data.length === 0) {
            await stripe.customers.update(customer.id, {
              metadata: { ...customer.metadata, userId: options.userId },
            });
            return customer.id;
          }
        } else {
          return customer.id;
        }
      }
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}
