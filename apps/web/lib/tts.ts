"use client";
/**
 * Speech output. Japanese material sentences play pre-generated neural audio
 * (edge-tts ja-JP-NanamiNeural, 24 kHz / 48 kbps mp3 in /public/audio/ja); everything else
 * uses the browser's speechSynthesis with the best available voice for the language.
 *
 * Root cause of the "robotic Japanese" report: we only set utterance.lang (or took the first
 * voice whose lang matched), so browsers picked their default/compact ja-JP voice
 * (e.g. eSpeak on Linux, "Haruka Desktop" on Windows) while en-US defaults are decent.
 */

type Lang = "en" | "ja";

const PREFERRED: Record<Lang, RegExp[]> = {
  ja: [/Nanami.*Natural|Natural.*Nanami/i, /Keita.*Natural/i, /Google.*日本語|Google.*Japanese/i, /Nanami/i, /O-?ren/i, /Kyoko/i, /Siri/i, /Neural|Natural|Enhanced|Premium/i],
  en: [/Natural|Neural/i, /Google US English/i, /Samantha|Alex|Ava|Aria|Jenny/i, /Enhanced|Premium/i],
};

export function pickBestVoice(lang: Lang, voices?: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const all = voices ?? (typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
  const prefix = lang === "ja" ? "ja" : "en-US";
  const candidates = all.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(prefix.toLowerCase()));
  if (candidates.length === 0) return null;
  for (const re of PREFERRED[lang]) {
    const hit = candidates.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  // Avoid eSpeak-style robotic voices when anything else exists.
  return candidates.find((v) => !/espeak/i.test(v.name)) ?? candidates[0];
}

let manifest: Record<string, string> | null = null;
let manifestPromise: Promise<Record<string, string>> | null = null;
const norm = (t: string) => String(t ?? "").replace(/\s+/g, "");

export function loadJaAudioManifest(): Promise<Record<string, string>> {
  if (manifest) return Promise.resolve(manifest);
  if (!manifestPromise) {
    manifestPromise = fetch("/audio/ja/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((m: Record<string, string>) => (manifest = m));
  }
  return manifestPromise;
}

/** Extra pre-recorded audio (e.g. vocabulary words / example sentences), any language. */
const extraAudio = new Map<string, string>();
export function registerPrerecorded(entries: Record<string, string>): void {
  for (const [text, url] of Object.entries(entries)) if (text && url) extraAudio.set(norm(text).toLowerCase(), url);
}

export function prerecordedUrl(text: string, lang: Lang): string | null {
  const extra = extraAudio.get(norm(text).toLowerCase());
  if (extra) return extra;
  if (lang !== "ja" || !manifest) return null;
  const file = manifest[norm(text)];
  return file ? `/audio/ja/${file}` : null;
}

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/** Play text; resolves when playback ends. `rate` is the UI speed (0.6 / 0.85 / 1.0). */
export async function playSpeech(text: string, lang: Lang, rate = 0.9, onStart?: () => void): Promise<void> {
  if (typeof window === "undefined") return;
  stopSpeech();
  if (lang === "ja") await loadJaAudioManifest();
  const url = prerecordedUrl(text, lang);
  if (url && typeof Audio !== "undefined") {
    const ok = await new Promise<boolean>((resolve) => {
      const audio = new Audio(url);
      currentAudio = audio;
      // Neural audio is recorded at natural speed: map UI speed 0.85 → 1.0.
      audio.playbackRate = Math.max(0.5, Math.min(1.5, rate / 0.85));
      (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.onpause = () => resolve(true);
      audio.play().then(() => onStart?.()).catch(() => resolve(false));
    });
    if (ok) return;
  }
  if (!window.speechSynthesis) return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "ja" ? "ja-JP" : "en-US";
    const voice = pickBestVoice(lang);
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onstart = () => onStart?.();
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
