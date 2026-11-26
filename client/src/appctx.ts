import type { SessionUser } from "./lib";

export type Page =
  | "dashboard"
  | "chat"
  | "image"
  | "homework"
  | "youtube"
  | "ocr"
  | "pdf"
  | "code"
  | "python"
  | "translate"
  | "music"
  | "quiz"
  | "focus"
  | "notes"
  | "reminders"
  | "dictionary"
  | "facts"
  | "qr"
  | "shortener"
  | "prompts"
  | "news"
  | "weather"
  | "crypto"
  | "cricket"
  | "games"
  | "leaderboard"
  | "profile"
  | "desktop"
  | "about"
  | "feedback"
  | "install"
  | "admin";

export interface PageProps {
  token?: string;
  user: SessionUser;
  go: (page: Page) => void;
  refreshUser: () => void;
}

export function setChatPrefill(text: string) {
  try {
    localStorage.setItem("qwara-chat-prefill", text);
  } catch {
    /* ignore */
  }
}
export function takeChatPrefill(): string {
  try {
    const v = localStorage.getItem("qwara-chat-prefill") ?? "";
    localStorage.removeItem("qwara-chat-prefill");
    return v;
  } catch {
    return "";
  }
}

// Dashboard "Talk to Yukti" button: ask the Chat page to open straight into
// Voice Assistant mode on mount.
export function setVoiceAutoStart() {
  try {
    localStorage.setItem("qwara-voice-autostart", "1");
  } catch {
    /* ignore */
  }
}
export function takeVoiceAutoStart(): boolean {
  try {
    const v = localStorage.getItem("qwara-voice-autostart") === "1";
    localStorage.removeItem("qwara-voice-autostart");
    return v;
  } catch {
    return false;
  }
}
