import { isNativeApp, selectionHaptic, successHaptic } from "@/lib/native";

export async function studySelectionFeedback() {
  if (isNativeApp()) return selectionHaptic();
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
}

export async function studySuccessFeedback() {
  if (isNativeApp()) return successHaptic();
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([12, 30, 12]);
}
