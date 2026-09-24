export async function studySelectionFeedback() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
}

export async function studySuccessFeedback() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([12, 30, 12]);
}
