// Browser side of Paddle: loads Paddle.js once and opens its checkout overlay
// for a transaction the server created (so the account can't be swapped).

interface PaddleEventData {
  name?: string;
}

interface PaddleJs {
  Environment: { set(environment: "sandbox"): void };
  Initialize(options: { token: string; eventCallback?: (event: PaddleEventData) => void }): void;
  Checkout: {
    open(options: {
      transactionId: string;
      settings?: {
        displayMode?: "overlay";
        theme?: "light" | "dark";
        successUrl?: string;
        allowLogout?: boolean;
      };
    }): void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

const SCRIPT_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

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

/** Opens the checkout; `onComplete` runs when Paddle reports the payment went through. */
export async function openPaddleCheckout(
  transactionId: string,
  onComplete: () => void,
): Promise<void> {
  const paddle = await loadPaddle();
  onEvent = (event) => {
    if (event.name === "checkout.completed") onComplete();
  };
  paddle.Checkout.open({
    transactionId,
    settings: {
      displayMode: "overlay",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      allowLogout: false,
    },
  });
}
