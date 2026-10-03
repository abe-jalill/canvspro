export async function studySelectionFeedback() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
}

export async function studySuccessFeedback() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([12, 30, 12]);
}

/** A soft chime and a gentle buzz when a pomodoro moves between focus and break. */
export async function studyPhaseFeedback() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([20, 40, 20]);
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const audio = new Context();
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.type = "sine";
    tone.frequency.value = 528;
    volume.gain.setValueAtTime(0.0001, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.06, audio.currentTime + 0.05);
    volume.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.9);
    tone.connect(volume).connect(audio.destination);
    tone.start();
    tone.stop(audio.currentTime + 0.95);
    tone.onended = () => void audio.close();
  } catch {
    // Browsers may block audio until the page has been interacted with; the
    // toast and vibration still tell the person what happened.
  }
}
