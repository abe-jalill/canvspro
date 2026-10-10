// Background noise for study sessions: white or brown noise generated in the
// browser (no audio files), played only during focus time.

export type NoiseKind = "off" | "white" | "brown";
export interface NoisePrefs {
  kind: NoiseKind;
  /** 0–1. */
  volume: number;
}

export const FOCUS_NOISE_KEY = "canvas:focus-noise";
const CHANGE_EVENT = "canvaspro:focus-noise";
export const DEFAULT_NOISE: NoisePrefs = { kind: "off", volume: 0.5 };

export function normalizeNoisePrefs(value: unknown): NoisePrefs {
  const v = (value ?? {}) as Partial<NoisePrefs>;
  const kind = v.kind === "white" || v.kind === "brown" ? v.kind : "off";
  const volume =
    typeof v.volume === "number" && Number.isFinite(v.volume)
      ? Math.min(1, Math.max(0, v.volume))
      : DEFAULT_NOISE.volume;
  return { kind, volume };
}

let cached: NoisePrefs | null = null;

export function readNoisePrefs(): NoisePrefs {
  if (cached) return cached;
  try {
    cached = normalizeNoisePrefs(JSON.parse(localStorage.getItem(FOCUS_NOISE_KEY) ?? "null"));
  } catch {
    cached = DEFAULT_NOISE;
  }
  return cached;
}

export function writeNoisePrefs(next: NoisePrefs) {
  cached = normalizeNoisePrefs(next);
  try {
    localStorage.setItem(FOCUS_NOISE_KEY, JSON.stringify(cached));
  } catch {
    /* The choice still applies for this visit without storage. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeNoisePrefs(onChange: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== FOCUS_NOISE_KEY) return;
    cached = null;
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", storage);
  };
}

/**
 * Fills one loopable buffer of noise. Brown noise is white noise run through a
 * leaky integrator (deep, rumbly), then de-trended so the last sample meets the
 * first and the loop has no click.
 */
export function fillNoise(
  kind: Exclude<NoiseKind, "off">,
  length: number,
  random: () => number = Math.random,
): Float32Array {
  const out = new Float32Array(length);
  if (kind === "white") {
    for (let i = 0; i < length; i++) out[i] = random() * 2 - 1;
    return out;
  }
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (random() * 2 - 1)) / 1.02;
    out[i] = last * 3.5;
  }
  const drift = length > 1 ? (out[length - 1]! - out[0]!) / (length - 1) : 0;
  for (let i = 0; i < length; i++) out[i] = Math.max(-1, Math.min(1, out[i]! - drift * i));
  return out;
}

/** White noise is far brighter than brown at the same amplitude. */
const LEVEL: Record<Exclude<NoiseKind, "off">, number> = { white: 0.12, brown: 0.6 };
const FADE_SECONDS = 0.35;
const LOOP_SECONDS = 8;

type AudioContextCtor = typeof AudioContext;

class NoisePlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private playing: Exclude<NoiseKind, "off"> | null = null;
  private buffers = new Map<string, AudioBuffer>();

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return null;
    // iOS mutes Web Audio with the ring/silent switch unless the page asks for playback.
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
    this.context = new Ctor();
    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.context.destination);
    return this.context;
  }

  /** Browsers only start audio after a tap or click; call this from one. */
  unlock() {
    const context = this.ensureContext();
    if (context?.state === "suspended") void context.resume();
  }

  set(kind: NoiseKind, volume: number) {
    if (kind === "off") return this.stop();
    const context = this.ensureContext();
    if (!context || !this.gain) return;
    if (context.state === "suspended") void context.resume();
    if (this.playing !== kind) {
      this.source?.stop(context.currentTime + FADE_SECONDS);
      const source = context.createBufferSource();
      source.buffer = this.bufferFor(context, kind);
      source.loop = true;
      source.connect(this.gain);
      source.start();
      this.source = source;
      this.playing = kind;
    }
    this.gain.gain.setTargetAtTime(LEVEL[kind] * volume, context.currentTime, FADE_SECONDS / 3);
  }

  stop() {
    if (!this.context || !this.gain || !this.source) return;
    const now = this.context.currentTime;
    this.gain.gain.setTargetAtTime(0, now, FADE_SECONDS / 3);
    this.source.stop(now + FADE_SECONDS);
    this.source = null;
    this.playing = null;
  }

  private bufferFor(context: AudioContext, kind: Exclude<NoiseKind, "off">) {
    const key = `${kind}:${context.sampleRate}`;
    let buffer = this.buffers.get(key);
    if (!buffer) {
      const length = context.sampleRate * LOOP_SECONDS;
      buffer = context.createBuffer(2, length, context.sampleRate);
      // Different noise per ear sounds wider and more natural.
      buffer.getChannelData(0).set(fillNoise(kind, length));
      buffer.getChannelData(1).set(fillNoise(kind, length));
      this.buffers.set(key, buffer);
    }
    return buffer;
  }
}

let player: NoisePlayer | null = null;
export function noisePlayer() {
  player ??= new NoisePlayer();
  return player;
}
