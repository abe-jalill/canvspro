import { supabase } from "@/integrations/supabase/client";

const RETRYABLE_TRANSPORT_ERROR = /failed to send|failed to fetch|networkerror|network request/i;

export async function invokeCanvasEdge<T>(body: Record<string, unknown>) {
  let result = await supabase.functions.invoke<T>("canvas", { body });
  if (result.error && RETRYABLE_TRANSPORT_ERROR.test(result.error.message ?? "")) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    result = await supabase.functions.invoke<T>("canvas", { body });
  }
  return result;
}

export function friendlyCanvasTransportError(message: string): string {
  return RETRYABLE_TRANSPORT_ERROR.test(message)
    ? "Couldn't reach CanvasPro's secure Canvas service. Check your connection and try again."
    : message;
}
