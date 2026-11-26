// Shared client helpers for QWARA AI.

import { useEffect, useRef, useState } from "react";

// ------------------------------------------------------------------ branding
// The product name lives ONLY here. Rename the app by changing this one line.
export const BRAND = {
  name: "Yukti AI",
  short: "Yukti",
  tagline: "Your personal AI command centre",
  creator: "Lakshya Pandey",
  defaultWakePhrase: "Hey Yukti",
};

// ------------------------------------------------------- assistant languages
// One list drives everything language-related: the chat language picker,
// speech recognition, text-to-speech, and the language name handed to the
// AI so it replies in the user's language. `code` is a BCP-47 tag understood
// by the browser's speech engines; `englishName` is what we tell the AI /
// the translator ("Reply in Hindi", targetLanguage "Hindi").
export type AssistantLanguage = { code: string; label: string; englishName: string };

export const ASSISTANT_LANGUAGES: AssistantLanguage[] = [
  { code: "en-IN", label: "English (India)", englishName: "English" },
  { code: "en-US", label: "English (US)", englishName: "English" },
  { code: "en-GB", label: "English (UK)", englishName: "English" },
  { code: "hi-IN", label: "हिन्दी · Hindi", englishName: "Hindi" },
  { code: "bn-IN", label: "বাংলা · Bengali", englishName: "Bengali" },
  { code: "te-IN", label: "తెలుగు · Telugu", englishName: "Telugu" },
  { code: "mr-IN", label: "मराठी · Marathi", englishName: "Marathi" },
  { code: "ta-IN", label: "தமிழ் · Tamil", englishName: "Tamil" },
  { code: "gu-IN", label: "ગુજરાતી · Gujarati", englishName: "Gujarati" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ · Punjabi", englishName: "Punjabi" },
  { code: "kn-IN", label: "ಕನ್ನಡ · Kannada", englishName: "Kannada" },
  { code: "ml-IN", label: "മലയാളം · Malayalam", englishName: "Malayalam" },
  { code: "ur-IN", label: "اردو · Urdu", englishName: "Urdu" },
  { code: "es-ES", label: "Español · Spanish", englishName: "Spanish" },
  { code: "fr-FR", label: "Français · French", englishName: "French" },
  { code: "de-DE", label: "Deutsch · German", englishName: "German" },
  { code: "pt-PT", label: "Português · Portuguese", englishName: "Portuguese" },
  { code: "it-IT", label: "Italiano · Italian", englishName: "Italian" },
  { code: "ru-RU", label: "Русский · Russian", englishName: "Russian" },
  { code: "ar-SA", label: "العربية · Arabic", englishName: "Arabic" },
  { code: "ja-JP", label: "日本語 · Japanese", englishName: "Japanese" },
  { code: "ko-KR", label: "한국어 · Korean", englishName: "Korean" },
  { code: "zh-CN", label: "中文 · Chinese", englishName: "Chinese" },
];

export function languageNameFor(code: string): string {
  return ASSISTANT_LANGUAGES.find((l) => l.code === code)?.englishName ?? "English";
}

// Detects Hindi in either script: Devanagari characters, or Roman-script
// Hindi (Hinglish) via its most common words (two or more markers, so plain
// English sentences don't trip it). Used to keep recognition and speech in
// the user's own language.
const ROMAN_HINDI_MARKERS =
  /\b(hai|hain|kya|kyu|kyun|mera|meri|mere|mujhe|tum|aap|karo|kar|ka|ki|ke|mein|nahi|aur|batao|sunao|chahiye|wala|wali|kab|kaisa|kaisi|bahut|accha|theek|bolo|raha|rahi|rahe|tha|thi|hoga|matlab|samay|mausam|khabar|bolo|ruk|jao|gaya|gayi|liye|bhi|toh|na|arre|yaar)\b/gi;

export function detectHindi(text: string): boolean {
  if (/[\u0900-\u097F]/.test(text)) return true;
  const hits = text.toLowerCase().match(ROMAN_HINDI_MARKERS);
  return (hits?.length ?? 0) >= 2;
}

// The language a reply should be SPOKEN in: anything Hindi (either script)
// is spoken with the Hindi voice so pronunciation stays natural instead of
// an English accent reading Hindi words; everything else uses the fallback
// (the user's chosen language).
export function speechLangFor(text: string, fallback: string): string {
  return detectHindi(text) ? "hi-IN" : fallback;
}

// ------------------------------------------------------------------ session
const TOKEN_KEY = "qwara-token";

export function getToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export type SessionUser = {
  id: number;
  email: string;
  displayName: string;
  role: string;
  emailVerified: boolean;
  authProvider: string;
  prefs: Record<string, string>;
};

// ------------------------------------------------------------------ speech
export type SpeechHooks = {
  recognition: unknown | null;
  supported: boolean;
};

declare global {
  interface Window {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  }
}

export function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  const ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined;
  return ctor ?? null;
}

export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export type SpeechResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

// ------------------------------------------------------------- voice styles
// Six selectable voices for the assistant. Each preset has a GENDER, a
// speaking rate/pitch, and its own voice-name preferences; at speak time
// the app scores the device's installed voices for the current language,
// strongly preferring a voice of the preset's gender and its preferred
// names (voices with "Natural"/"Neural"/"Google" in the name sound far
// less robotic than the old compact system voices). The presets'
// preference lists are deliberately DIFFERENT from each other — when they
// were near-identical, every style resolved to the same installed voice
// and switching styles changed nothing the ear could hear.
// `demo` is a short line the user can preview before choosing.
export type VoicePreset = {
  id: string;
  label: string;
  hint: string;
  gender: "female" | "male";
  rate: number;
  pitch: number;
  prefer: string[];
  demo: string;
};

export const VOICE_PRESETS: VoicePreset[] = [
  {
    // The approved voice from the demos: the exact "Clear" tuning the user
    // picked, now named Diya and made the default.
    id: "diya",
    label: "Diya",
    hint: "Clear female voice — smooth, crisp and natural",
    gender: "female",
    rate: 1.0,
    pitch: 1.05,
    prefer: ["google us english", "samantha", "zira", "veena", "natural", "neural", "google"],
    demo: "Hello, I am Diya. I will be your clear, natural voice, ready when you are.",
  },
  {
    id: "jarvis",
    label: "Jarvis",
    hint: "Jarvis Mode — calm, precise British male butler: clipped, composed, never loud",
    gender: "male",
    rate: 0.92,
    pitch: 0.8,
    prefer: ["daniel", "george", "arthur", "uk english male", "brian", "natural", "neural"],
    demo: "Good day. I am Jarvis. All systems are ready. How may I assist you?",
  },
  {
    id: "meera",
    label: "Meera",
    hint: "Soft female voice — mellow, gentle and clear",
    gender: "female",
    rate: 0.9,
    pitch: 0.97,
    prefer: ["heera", "veena", "lekha", "premium", "natural", "google"],
    demo: "Hi, I am Meera. My voice is soft and calm. Ask me anything, I am right here.",
  },
  {
    id: "tara",
    label: "Tara",
    hint: "Friendly female voice — bright, cheerful and natural",
    gender: "female",
    rate: 1.1,
    pitch: 1.2,
    prefer: ["zira", "aria", "jenny", "google", "natural", "neural"],
    demo: "Hey! I am Tara! Great to meet you. Let's make today awesome!",
  },
  {
    id: "anaya",
    label: "Anaya",
    hint: "Energetic, fresh, natural female voice — young and lively",
    gender: "female",
    rate: 1.14,
    pitch: 1.12,
    prefer: ["samantha", "aria", "zira", "natural", "google", "neural"],
    demo: "Hi! I am Anaya! Fresh, energetic and ready. Let's get started!",
  },
  {
    id: "kabir",
    label: "Kabir",
    hint: "Natural, casual, friendly male voice — an everyday human, not a butler",
    gender: "male",
    rate: 1.03,
    pitch: 0.95,
    prefer: ["ravi", "david", "christopher", "google", "natural", "neural"],
    demo: "Hey, I am Kabir. Just a regular friendly voice. Tell me what's on your mind.",
  },
];

export const DEFAULT_VOICE_PRESET = "diya";

export function voicePreset(id: string | undefined): VoicePreset {
  return VOICE_PRESETS.find((p) => p.id === id) ?? VOICE_PRESETS[0]!;
}

export type SpeakOptions = {
  /** Exact voice name chosen in Profile (wins over the preset when set). */
  voiceName?: string;
  lang: string;
  presetId?: string;
};

// The device voice list, cached at module level: getVoices() returns an
// empty list in some browsers until the voiceschanged event fires, and a
// speak call made in that window silently fell back to the browser's
// default voice — one more way the chosen style "didn't change anything".
let voiceCache: SpeechSynthesisVoice[] = [];
let voiceCacheWired = false;

function currentVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  if (!voiceCacheWired) {
    voiceCacheWired = true;
    try {
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        voiceCache = window.speechSynthesis.getVoices();
      });
    } catch {
      /* older engines without addEventListener on speechSynthesis */
    }
  }
  const list = window.speechSynthesis.getVoices();
  if (list.length) voiceCache = list;
  return voiceCache;
}

// Best-effort gender read from a voice's name. Female is checked first:
// "female" itself contains the substring "male".
const FEMALE_HINTS = [
  "female", "samantha", "zira", "veena", "heera", "lekha", "aria", "jenny",
  "allison", "ava", "emma", "sophia", "olivia", "kate", "serena", "moira",
  "tessa", "fiona", "karen", "nicky", "joana", "salli", "kimberly",
];
const MALE_HINTS = [
  "male", "daniel", "george", "arthur", "brian", "david", "ravi",
  "christopher", "alex", "fred", "ryan", "aaron", "matthew", "justin",
  "guy", "uk english male",
];

function voiceGender(name: string): "female" | "male" | null {
  if (FEMALE_HINTS.some((h) => name.includes(h))) return "female";
  if (MALE_HINTS.some((h) => name.includes(h))) return "male";
  return null;
}

function pickVoice(opts: SpeakOptions): { voice: SpeechSynthesisVoice | null; rate: number; pitch: number } {
  const preset = voicePreset(opts.presetId);
  const voices = currentVoices();
  if (opts.voiceName) {
    const exact = voices.find((v) => v.name === opts.voiceName);
    if (exact) return { voice: exact, rate: preset.rate, pitch: preset.pitch };
  }
  const langPrefix = (opts.lang || "en").slice(0, 2).toLowerCase();
  const scored = voices
    .map((v) => {
      const name = v.name.toLowerCase();
      let score = 0;
      if (v.lang.toLowerCase().startsWith(langPrefix)) score += 40;
      else if (v.lang.toLowerCase().startsWith("en")) score += 10;
      // Gender is the loudest difference between these styles: a voice of
      // the wrong gender is heavily penalized, the right gender rewarded,
      // so Jarvis/Kabir never come out in a female voice (or vice versa)
      // when the device has both.
      const g = voiceGender(name);
      if (g && g !== preset.gender) score -= 80;
      if (g && g === preset.gender) score += 25;
      preset.prefer.forEach((kw, i) => {
        if (name.includes(kw)) score += 34 - i * 4;
      });
      if (name.includes("compact") || name.includes("eloquence") || name.includes("whisper")) score -= 25;
      if (v.default) score += 2;
      return { v, score };
    })
    .sort((a, b) => b.score - a.score);
  return { voice: scored[0]?.v ?? null, rate: preset.rate, pitch: preset.pitch };
}

function makeUtterance(text: string, opts: SpeakOptions): SpeechSynthesisUtterance | null {
  if (!("speechSynthesis" in window)) return null;
  const clean = text.replace(/[*#`_>]/g, "").slice(0, 1200);
  if (!clean.trim()) return null;
  const utter = new SpeechSynthesisUtterance(clean);
  const { voice, rate, pitch } = pickVoice(opts);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else if (opts.lang) {
    utter.lang = opts.lang;
  }
  utter.rate = rate;
  utter.pitch = pitch;
  return utter;
}

export function speak(text: string, opts: SpeakOptions) {
  const utter = makeUtterance(text, opts);
  if (!utter) return false;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  return true;
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// Speaks and resolves when the utterance finishes (or errors / times out),
// so the voice-assistant loop can start listening again right after Yukti
// stops talking. Resolves false when speech synthesis is unavailable.
export function speakAsync(text: string, opts: SpeakOptions): Promise<boolean> {
  const utter = makeUtterance(text, opts);
  if (!utter) return Promise.resolve("speechSynthesis" in window);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve(true);
      }
    };
    utter.onend = finish;
    utter.onerror = finish;
    // Only cancel when something is actually speaking or queued: an
    // unconditional cancel() right before speak() makes some engines
    // (notably Chrome) pause before the next utterance, which added a
    // beat of dead air between every sentence of a spoken reply.
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();
    synth.speak(utter);
    // Safety net: some browsers never fire onend for long utterances.
    const cleanLen = utter.text.length;
    setTimeout(finish, Math.min(45000, 2500 + cleanLen * 68));
  });
}

// ------------------------------------------------------------------ wake word
// Normalizes a transcript for wake-phrase matching: lowercase, punctuation
// stripped, whitespace collapsed.
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"'“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Checks whether a transcript contains the wake phrase. The built-in phrase
// is "Hey Yukti"; common recognition variants ("ok yukti", "hey yukti",
// "hey yukti") also match, plus the user's customized phrase from their
// profile. Returns the words spoken AFTER the wake phrase as `command`
// ("" when they only said the wake phrase itself).
export function matchWakePhrase(
  transcript: string,
  customPhrase: string,
): { matched: boolean; command: string } {
  const heard = normalizeSpeech(transcript);
  if (!heard) return { matched: false, command: "" };
  const candidates = new Set<string>([
    "hey yukti",
    "ok yukti",
    "hey yukti",
    "hey yukti",
    "a yukti",
  ]);
  const custom = normalizeSpeech(customPhrase || "");
  if (custom) candidates.add(custom);
  let bestIdx = -1;
  let bestLen = 0;
  for (const c of candidates) {
    const idx = heard.indexOf(c);
    if (idx >= 0 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      bestLen = c.length;
    }
  }
  if (bestIdx === -1) return { matched: false, command: "" };
  const command = heard.slice(bestIdx + bestLen).trim();
  return { matched: true, command };
}

// Phrases that end the voice conversation (English + Hinglish).
const STOP_PHRASES = [
  "stop",
  "stop listening",
  "band karo",
  "bandh karo",
  "ruk jao",
  "ruko",
  "bas karo",
  "chup",
  "goodbye",
  "bye yukti",
  "exit",
  "cancel",
];
export function isStopCommand(transcript: string): boolean {
  const t = normalizeSpeech(transcript);
  return STOP_PHRASES.some((p) => t === p || t.startsWith(`${p} `));
}

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    // addEventListener (not onvoiceschanged): the module-level voice cache
    // in currentVoices() listens on the same event and must not be
    // clobbered by this hook.
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);
  return voices;
}

// A tiny two-tone earcon — the instant "I'm listening" acknowledgement
// when the wake word is heard. Sound, not speech: it plays in a few
// milliseconds (no TTS startup delay) and the microphone doesn't mistake
// it for the user's words, so listening can start in the same moment.
let earconCtx: AudioContext | null = null;

export function playEarcon() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    earconCtx ??= new Ctor();
    const ctx = earconCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    const notes: Array<[number, number]> = [
      [880, 0],
      [1318.5, 0.09],
    ];
    for (const [freq, dt] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + dt);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.1);
    }
  } catch {
    /* the earcon is a nicety, never a blocker */
  }
}

// ------------------------------------------------------------------ countdown hook
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// ------------------------------------------------------------------ offline stores
export type LocalNote = {
  clientId: string;
  title: string;
  body: string;
  updatedAt: number;
  deleted?: boolean;
};
export type LocalReminder = {
  clientId: string;
  text: string;
  dueText: string;
  done: boolean;
  updatedAt: number;
  deleted?: boolean;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full/blocked */
  }
}

export const localNotes = {
  all(): LocalNote[] {
    return readJson<LocalNote[]>("qwara-notes", []);
  },
  saveAll(notes: LocalNote[]) {
    writeJson("qwara-notes", notes);
  },
};

export const localReminders = {
  all(): LocalReminder[] {
    return readJson<LocalReminder[]>("qwara-reminders", []);
  },
  saveAll(reminders: LocalReminder[]) {
    writeJson("qwara-reminders", reminders);
  },
};

export function newClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------- study time table
// A small daily study timetable ("roz 5 baje Maths, 6 baje Science"). Kept
// in the same offline-first localStorage pattern as notes/reminders, and
// mirrored into the user's server prefs in a compact string so it survives
// across devices (prefs values are capped at 200 chars, hence the compact
// "17:00|Maths;18:00|Science" form). Max 8 entries — a school day, not a
// railway chart.
export type TimetableEntry = { id: string; time: string; subject: string }; // time is "HH:MM", 24h

export const localTimetable = {
  all(): TimetableEntry[] {
    return readJson<TimetableEntry[]>("qwara-timetable", []);
  },
  saveAll(entries: TimetableEntry[]) {
    writeJson("qwara-timetable", entries);
  },
};

export function timetableToPref(entries: TimetableEntry[]): string {
  return entries
    .map((e) => `${e.time}|${e.subject.replace(/[;|]/g, " ").trim()}`)
    .join(";")
    .slice(0, 200);
}

export function timetableFromPref(value: string | undefined): TimetableEntry[] {
  if (!value) return [];
  return value
    .split(";")
    .map((part, i) => {
      const [time = "", ...rest] = part.split("|");
      return { id: `pref-${i}`, time: time.trim(), subject: rest.join("|").trim() };
    })
    .filter((e) => /^\d{2}:\d{2}$/.test(e.time) && e.subject.length > 0);
}

export function formatTime12h(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Parses spoken/typed timetable entries — "5 baje maths, 6:30 pm science",
// "roz 17:00 history" — into entries, in the order spoken. A bare "N baje"
// in a study context means the evening (after school) unless the segment
// says "subah"/morning, which is how the user phrases it.
export function parseTimetableEntries(text: string): TimetableEntry[] {
  const out: TimetableEntry[] = [];
  const segments = text.split(/,| and | aur | phir /i);
  for (const seg of segments) {
    const m = seg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|बजे)?/i);
    if (!m) continue;
    let hour = parseInt(m[1] ?? "0", 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    const marker = (m[3] ?? "").toLowerCase();
    if (marker === "pm" && hour < 12) hour += 12;
    if (marker === "am" && hour === 12) hour = 0;
    if ((marker === "baje" || marker === "बजे") && !/subah|morning|सुबह/.test(seg.toLowerCase()) && hour >= 1 && hour < 12) {
      hour += 12;
    }
    if (hour > 23 || minute > 59) continue;
    const subject = seg
      .replace(m[0], " ")
      .replace(
        /\b(roz|daily|har|time\s?table|timetable|mein|me|add|karo|kar|do|padhai|padhna|study|ka|ki|ke|liye|baje|am|pm|se|subject|shaam|sham|raat|subah|morning|evening|बजे)\b/gi,
        " ",
      )
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!subject) continue;
    out.push({
      id: newClientId(),
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      subject: subject.charAt(0).toUpperCase() + subject.slice(1),
    });
  }
  return out.slice(0, 8);
}

// -------------------------------------------------------------- focus music
// Built-in ambient loops generated live with WebAudio — no audio files, no
// network, nothing to license. Two soft styles: slow warm chord pads
// ("calm") and gentle filtered brown-noise rain ("rain"). One shared
// player, so chat, the voice loop and the on-screen strip all control the
// same sound.
export type FocusMusicStyle = "calm" | "rain";

const FOCUS_CHORDS: number[][] = [
  [110.0, 164.81, 196.0, 261.63], // Am7
  [87.31, 130.81, 164.81, 220.0], // Fmaj7
  [130.81, 196.0, 246.94, 329.63], // Cmaj7
  [98.0, 146.83, 196.0, 246.94], // G
];

const fm: {
  ctx: AudioContext | null;
  master: GainNode | null;
  sources: AudioScheduledSourceNode[];
  timer: number | null;
  style: FocusMusicStyle | null;
  listeners: Set<() => void>;
} = { ctx: null, master: null, sources: [], timer: null, style: null, listeners: new Set() };

function fmNotify() {
  fm.listeners.forEach((fn) => fn());
}

function fmTeardown(fade: boolean) {
  if (fm.timer !== null) {
    window.clearInterval(fm.timer);
    fm.timer = null;
  }
  const sources = fm.sources;
  const master = fm.master;
  const ctx = fm.ctx;
  fm.sources = [];
  fm.master = null;
  const kill = () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    if (master) {
      try {
        master.disconnect();
      } catch {
        /* already disconnected */
      }
    }
  };
  if (fade && ctx && master) {
    try {
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    } catch {
      /* fade is a nicety */
    }
    window.setTimeout(kill, 400);
  } else {
    kill();
  }
}

export const focusMusic = {
  isPlaying(): boolean {
    return fm.style !== null;
  },
  style(): FocusMusicStyle | null {
    return fm.style;
  },
  subscribe(fn: () => void): () => void {
    fm.listeners.add(fn);
    return () => {
      fm.listeners.delete(fn);
    };
  },
  start(style: FocusMusicStyle) {
    fmTeardown(false);
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      fm.ctx ??= new Ctor();
      const ctx = fm.ctx;
      void ctx.resume();
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      fm.master = master;
      fm.style = style;
      if (style === "rain") {
        // Brown-ish noise through a lowpass filter reads as soft rain.
        const len = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.2;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 850;
        const g = ctx.createGain();
        g.gain.value = 0.55;
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start();
        fm.sources.push(src);
      } else {
        let idx = 0;
        const playChord = () => {
          const chord = FOCUS_CHORDS[idx % FOCUS_CHORDS.length] ?? FOCUS_CHORDS[0]!;
          idx += 1;
          const dur = 9.5;
          for (const freq of chord) {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const t0 = ctx.currentTime;
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(0.045, t0 + 2.5);
            g.gain.setValueAtTime(0.045, t0 + dur - 2.5);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            osc.connect(g);
            g.connect(master);
            osc.start(t0);
            osc.stop(t0 + dur);
            fm.sources.push(osc);
          }
        };
        playChord();
        fm.timer = window.setInterval(playChord, 7000);
      }
      fmNotify();
    } catch {
      fm.style = null;
    }
  },
  stop() {
    if (fm.style === null) return;
    fm.style = null;
    fmTeardown(true);
    fmNotify();
  },
};

export function useFocusMusic(): { playing: boolean; style: FocusMusicStyle | null } {
  const [snap, setSnap] = useState(() => ({ playing: focusMusic.isPlaying(), style: focusMusic.style() }));
  useEffect(
    () =>
      focusMusic.subscribe(() => setSnap({ playing: focusMusic.isPlaying(), style: focusMusic.style() })),
    [],
  );
  return snap;
}

// ------------------------------------------------------------------ built-in content (labelled in UI)
export const BUILTIN_FACTS: string[] = [
  "Honey never spoils — archaeologists have tasted 3,000-year-old honey from Egyptian tombs and found it perfectly edible.",
  "Octopuses have three hearts, and two of them stop beating when the octopus swims.",
  "The first computer bug was a real moth, found taped inside a Harvard computer log book in 1947.",
  "Bananas are berries, but strawberries — botanically speaking — are not.",
  "A day on Venus is longer than a year on Venus: it rotates slower than it orbits the Sun.",
  "The Eiffel Tower grows about 15 cm taller in summer as the iron expands in the heat.",
  "Sea otters hold hands while sleeping so they don't drift away from each other.",
  "There are more possible chess games than atoms in the observable universe.",
  "Wombat poop is cube-shaped — it stacks and doesn't roll away from their territory.",
  "The inventor of the Pringles can is buried in one.",
  "Hot water can freeze faster than cold water — it's called the Mpemba effect, and scientists still debate why.",
  "Your nose can remember around 50,000 different scents.",
  "The first oranges weren't orange — Southeast Asian oranges were actually green.",
  "A bolt of lightning is five times hotter than the surface of the Sun.",
  "Scotland's national animal is the unicorn.",
  "The dot over the letter 'i' has a name: it's called a tittle.",
  "An astronaut's footprint on the Moon will stay there for millions of years — there's no wind to erase it.",
  "Cows have best friends and get stressed when they are separated.",
  "The longest word you can type with one hand is 'stewardesses'.",
  "Sound travels about 4.3 times faster in water than in air.",
  "A group of flamingos is called a flamboyance.",
  "The human brain generates roughly 20 watts of electrical power — enough to dimly power a lightbulb.",
  "M&M's were named after their inventors: Mars and Murrie.",
  "There's a species of jellyfish that is biologically immortal — it can restart its life cycle.",
  "The Great Wall of China is held together in places by sticky rice mortar.",
  "Sharks existed before trees — by about 50 million years.",
  "One teaspoon of a neutron star would weigh about a billion tons.",
  "The unicorn is mentioned in the King James Bible nine times (as a translation of 're'em').",
  "You share about 60% of your DNA with a banana.",
  "The first computer programmer was Ada Lovelace — in the 1840s, before computers existed.",
  "A single strand of spaghetti is called a spaghetto.",
];

export function dailyFact(date = new Date()): string {
  const dayIndex =
    Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
    ) % BUILTIN_FACTS.length;
  return BUILTIN_FACTS[dayIndex] ?? BUILTIN_FACTS[0]!;
}

export const STUDY_TIPS: string[] = [
  "Revise yesterday's topic for 10 minutes before starting anything new — spaced repetition beats cramming.",
  "Teach today's hardest concept out loud, as if to a friend. If you can't explain it simply, study it again.",
  "Do one timed practice paper this week. Exam hall pressure is a skill you can train.",
  "Keep your phone in another room during focus sessions — even face-down, it drains attention.",
  "Write formulas and key dates on one page and review it right before bed; sleep locks in memory.",
  "Break every chapter into 5 questions you could be asked, then answer them in writing.",
  "Mistake notebook day: re-solve every question you got wrong this week without looking at solutions first.",
];

export function dailyStudyTip(date = new Date()): string {
  const dayIndex =
    Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
    ) % STUDY_TIPS.length;
  return STUDY_TIPS[dayIndex] ?? STUDY_TIPS[0]!;
}

// Sample cricket scorecard — shown ONLY when the live feed is unreachable,
// and always labelled as sample data in the UI.
export const SAMPLE_CRICKET = {
  label: "Sample scorecard — live feed unavailable",
  matches: [
    {
      title: "India vs Australia · 2nd T20I (Sample)",
      status: "Sample data",
      lines: [
        "IND 186/5 (20 ov) — S. Yadav 72 (41), H. Pandya 38 (22)",
        "AUS 172/8 (20 ov) — T. Head 54 (30), M. Stoinis 41 (25)",
        "Result (sample): India won by 14 runs",
      ],
    },
    {
      title: "Mumbai vs Chennai · League Match (Sample)",
      status: "Sample data",
      lines: [
        "CHE 204/4 (20 ov) — R. Gaikwad 88 (52)",
        "MUM 190/7 (20 ov) — T. Varma 63 (38)",
        "Result (sample): Chennai won by 14 runs",
      ],
    },
  ],
};

export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function fileToBase64Payload(
  file: File,
): Promise<{ dataBase64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve({
        dataBase64: comma >= 0 ? result.slice(comma + 1) : result,
        mimeType: file.type,
      });
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/** The viewer's local calendar day as YYYY-MM-DD — the day the study
 * streak and the morning briefing count by. The server validates it. */
export function localDayString(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
