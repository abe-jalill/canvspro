// Browser side of Paddle: loads Paddle.js once and shows its checkout inline,
// inside our own page, for a transaction the server created (so the account
// can't be swapped). Paddle only draws the payment form; the order summary
// next to it is ours.

/** What Paddle's checkout events carry that the summary shows. */
export interface PaddleCheckoutTotals {
  currency: string;
  /** Charged today (0 during a trial). */
  total: number;
  /** What each renewal costs, tax included. */
  recurringTotal: number | null;
  recurringTax: number | null;
}

interface PaddleEventData {
  name?: string;
  data?: {
    currency_code?: string;
    totals?: { total?: number };
    recurring_totals?: { total?: number; tax?: number } | null;
  };
}

interface PaddleJs {
  Environment: { set(environment: "sandbox"): void };
  Initialize(options: { token: string; eventCallback?: (event: PaddleEventData) => void }): void;
  Checkout: {
    open(options: {
      transactionId: string;
      settings?: {
        displayMode?: "overlay" | "inline";
        variant?: "one-page" | "multi-page";
        frameTarget?: string;
        frameInitialHeight?: number;
        frameStyle?: string;
        theme?: "light" | "dark";
        allowLogout?: boolean;
        showAddDiscounts?: boolean;
      };
    }): void;
    close(): void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

const SCRIPT_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";
/** The class of the element the inline checkout draws into. */
export const PADDLE_FRAME_CLASS = "cp-paddle-frame";

let ready: Promise<PaddleJs> | null = null;
let onEvent: ((event: PaddleEventData) => void) | null = null;

export function paddleConfigured(): boolean {
  return Boolean(import.meta.env.VITE_PADDLE_CLIENT_TOKEN);
}

function loadPaddle(): Promise<PaddleJs> {
  if (ready) return ready;
  ready = new Promise<PaddleJs>((resolve, reject) => {
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
    if (!token) {
      reject(new Error("Checkout isn't available yet."));
      return;
    }
    const start = () => {
      const paddle = window.Paddle;
      if (!paddle) {
        reject(new Error("Couldn't load the checkout."));
        return;
      }
      if (import.meta.env.VITE_PADDLE_ENV !== "production") paddle.Environment.set("sandbox");
      paddle.Initialize({ token, eventCallback: (event) => onEvent?.(event) });
      resolve(paddle);
    };
    if (window.Paddle) {
      start();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = start;
    script.onerror = () => {
      ready = null;
      reject(new Error("Couldn't load the checkout. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return ready;
}

function readTotals(event: PaddleEventData): PaddleCheckoutTotals | null {
  const data = event.data;
  if (!data?.currency_code || typeof data.totals?.total !== "number") return null;
  return {
    currency: data.currency_code,
    total: data.totals.total,
    recurringTotal: data.recurring_totals?.total ?? null,
    recurringTax: data.recurring_totals?.tax ?? null,
  };
}

/**
 * Draws the checkout into the element with `PADDLE_FRAME_CLASS` (it must be on
 * the page). `onTotals` gets Paddle's prices with tax for the customer's
 * country; `onComplete` runs when the payment went through.
 */
export async function openPaddleCheckout(
  transactionId: string,
  handlers: {
    onComplete: () => void;
    onTotals?: (totals: PaddleCheckoutTotals) => void;
    /** The form has drawn (or shown its own error). */
    onReady?: () => void;
  },
): Promise<void> {
  const paddle = await loadPaddle();
  onEvent = (event) => {
    handlers.onReady?.();
    if (event.name === "checkout.completed") handlers.onComplete();
    const totals = readTotals(event);
    if (totals) handlers.onTotals?.(totals);
  };
  paddle.Checkout.open({
    transactionId,
    settings: {
      displayMode: "inline",
      variant: "one-page",
      frameTarget: PADDLE_FRAME_CLASS,
      frameInitialHeight: 450,
      frameStyle: "width: 100%; min-width: 286px; background-color: transparent; border: none;",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      allowLogout: false,
      showAddDiscounts: false,
    },
  });
}

export function closePaddleCheckout(): void {
  onEvent = null;
  window.Paddle?.Checkout.close();
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
