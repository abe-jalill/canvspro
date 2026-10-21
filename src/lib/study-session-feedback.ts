/**
 * A short buzz where the phone can. Browsers refuse (and log an error) until
 * the page has had a tap, so it waits for one.
 */
export function buzz(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  if (activation && !activation.hasBeenActive) return;
  navigator.vibrate(pattern);
}

export async function studySelectionFeedback() {
  buzz(8);
}

export async function studySuccessFeedback() {
  buzz([12, 30, 12]);
}

/** A soft chime and a gentle buzz when a pomodoro moves between focus and break. */
export async function studyPhaseFeedback() {
  buzz([20, 40, 20]);
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
