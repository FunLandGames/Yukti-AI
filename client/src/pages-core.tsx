// Dashboard + AI Chat pages.
//
// The Chat page IS the app: like Google Assistant / Alexa / Siri, the user
// just talks or types and Yukti does things — live weather, news, coin
// prices, currency conversion, word meanings, Wikipedia, web/YouTube
// search, generated pictures, saved notes and reminders, homework help,
// jokes and facts — or opens any feature page on request. A shared command
// router (runCommand) serves both typed chat and the Voice Assistant loop,
// so anything that works by typing also works by voice. Everything else
// falls through to the AI chat reply. Chat style/persona come from the
// user's saved Profile preferences; language and voice style are picked
// right on this page and saved to the profile.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { api, type ApiResponse } from "./api";
import type { Page, PageProps } from "./appctx";
import { setVoiceAutoStart, takeChatPrefill, takeVoiceAutoStart } from "./appctx";
import {
  ASSISTANT_LANGUAGES,
  BRAND,
  DEFAULT_VOICE_PRESET,
  VOICE_PRESETS,
  dailyFact,
  detectHindi,
  fileToBase64Payload,
  focusMusic,
  formatTime12h,
  isStopCommand,
  languageNameFor,
  localDayString,
  localNotes,
  localReminders,
  localTimetable,
  matchWakePhrase,
  newClientId,
  parseTimetableEntries,
  playEarcon,
  speakAsync,
  speechLangFor,
  speechRecognitionCtor,
  stopSpeaking,
  timetableFromPref,
  timetableToPref,
  useFocusMusic,
  useVoices,
  type LocalReminder,
  type SpeechRecognitionLike,
  type TimetableEntry,
} from "./lib";

const FIELDS = actionFields<typeof Actions>();

// ---------------------------------------------------------------- Dashboard
export function DashboardPage({ token, user, go, refreshUser }: PageProps) {
  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => api.getBootstrap({}),
  });
  const leaderboard = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.getLeaderboard({}),
    staleTime: 60000,
  });
  const streak = useQuery({
    queryKey: ["study-streak"],
    queryFn: () => api.getStudyStreak({ token, day: localDayString() }),
    staleTime: 60000,
  });
  const briefing = useQuery({
    queryKey: ["todays-briefing"],
    queryFn: () => api.getTodaysBriefing({ token, day: localDayString() }),
    staleTime: 60000,
  });
  const report = useQuery({
    queryKey: ["study-report"],
    queryFn: () => api.getStudyReport({ token, day: localDayString() }),
    staleTime: 60000,
  });
  const [timetable, setTimetableState] = useState<TimetableEntry[]>(() => loadTimetable(user.prefs.timetable));
  const [ttTime, setTtTime] = useState("17:00");
  const [ttSubject, setTtSubject] = useState("");
  const [ttError, setTtError] = useState("");
  const [copied, setCopied] = useState(false);
  const saveTimetablePref = useMutation({
    mutationFn: (entries: TimetableEntry[]) =>
      api.savePrefs({ token, prefs: { timetable: timetableToPref(entries) } }),
    onSuccess: () => refreshUser(),
    onError: () => setTtError("Saved on this device — account sync will retry later."),
  });

  function persistTimetable(next: TimetableEntry[]) {
    const sorted = sortedTimetable(next);
    setTimetableState(sorted);
    localTimetable.saveAll(sorted);
    mirrorTimetableReminders(sorted, token);
    saveTimetablePref.mutate(sorted);
  }
  const examDate = user.prefs.examDate ?? "";
  let daysLeft: number | null = null;
  if (examDate) {
    const target = new Date(`${examDate}T00:00:00`);
    if (!Number.isNaN(target.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      daysLeft = Math.round((target.getTime() - today.getTime()) / 86400000);
    }
  }

  const tiles: Array<{ page: Parameters<typeof go>[0]; label: string; hint: string }> = [
    { page: "chat", label: "Chat with Yukti", hint: "Ask anything" },
    { page: "homework", label: "Homework Help", hint: "Photo or type a question" },
    { page: "image", label: "Make a Picture", hint: "Describe it, get an image" },
    { page: "quiz", label: "Play a Quiz", hint: "Answer and earn points" },
    { page: "games", label: "Games", hint: "Play and earn points" },
    { page: "notes", label: "My Notes", hint: "Write and save notes" },
    { page: "focus", label: "Study Timer", hint: "Focus while you study" },
    { page: "youtube", label: "Video Summary", hint: "YouTube link → short summary" },
    { page: "news", label: "News", hint: "Today's headlines" },
    { page: "weather", label: "Weather", hint: "Any city's weather" },
    { page: "crypto", label: "Coin Prices", hint: "Bitcoin and more" },
    { page: "cricket", label: "Cricket Scores", hint: "Match scorecards" },
  ];

  return (
    <div className="space-y-5">
      <div className="panel px-4 py-4">
        <h2 className="font-display text-xl">
          Hi, <span className="neon-text">{user.displayName}</span>
        </h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Easiest way: just ask {BRAND.short} in chat — she can do almost everything from there.
        </p>
        {daysLeft !== null && daysLeft >= 0 && (
          <p className="mt-2 text-sm">
            {daysLeft === 0
              ? "Your exam is today — all the best!"
              : `${user.prefs.examName ? `${user.prefs.examName}: ` : "Exam: "}${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => go("chat")}>
            Chat with {BRAND.short}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setVoiceAutoStart();
              go("chat");
            }}
          >
            Talk to {BRAND.short} (voice)
          </button>
        </div>
      </div>

      {briefing.data?.status === "ready" && (
        <section className="panel px-4 py-4" aria-label="Today's morning briefing" style={{ borderColor: "var(--accent)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm neon-text">TODAY'S MORNING BRIEFING IS READY</h3>
            <span className="dot-live" aria-label="Briefing ready" />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{briefing.data.text}</p>
          {briefing.data.links.length > 0 && (
            <span className="mt-3 flex flex-wrap gap-2">
              {briefing.data.links.map((l) => (
                <a
                  key={l.url + l.label}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost text-xs"
                  style={{ minHeight: "2rem" }}
                >
                  {l.label.length > 42 ? `${l.label.slice(0, 42)}…` : l.label}
                </a>
              ))}
            </span>
          )}
        </section>
      )}

      {streak.data && (
        <section className="panel px-4 py-3" aria-label="Study streak">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              Study streak:{" "}
              <strong className="neon-text">
                {streak.data.currentStreak} day{streak.data.currentStreak === 1 ? "" : "s"}
              </strong>
            </span>
            <span className="text-[var(--dim)]">
              {streak.data.studiedToday
                ? "Today's study is done — streak safe!"
                : "Finish a quiz or a revision today to keep it going."}
            </span>
            <span className="text-[var(--dim)]">{streak.data.totalDays} study days in total</span>
          </div>
          {streak.data.badges.some((b) => b.earned) && (
            <p className="mt-2 flex flex-wrap gap-2">
              {streak.data.badges
                .filter((b) => b.earned)
                .map((b) => (
                  <span key={b.id} className="panel-raised px-2 py-1 text-xs" style={{ color: "var(--warn)" }}>
                    Badge: {b.label}
                  </span>
                ))}
            </p>
          )}
        </section>
      )}

      <section className="panel px-4 py-4" aria-label="Study time table">
        <h3 className="font-display text-sm neon-text">STUDY TIME TABLE</h3>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Set it here, or just tell {BRAND.short} in chat: “roz 5 baje Maths, 6 baje Science”. Every entry
          also lands in Reminders for its next time.
        </p>
        {timetable.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {timetable.map((e) => (
              <li key={e.id} className="panel-raised flex items-center gap-3 px-3 py-2 text-sm">
                <strong className="neon-text">{formatTime12h(e.time)}</strong>
                <span className="grow">{e.subject}</span>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  aria-label={`Remove ${e.subject} at ${formatTime12h(e.time)} from the time table`}
                  onClick={() => persistTimetable(timetable.filter((x) => x.id !== e.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--dim)]">No time table yet — add your first study time below.</p>
        )}
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const subject = ttSubject.trim();
            if (!subject) {
              setTtError("Type a subject first — like Maths or Science.");
              return;
            }
            if (!/^\d{2}:\d{2}$/.test(ttTime)) {
              setTtError("Pick a time first.");
              return;
            }
            setTtError("");
            persistTimetable([
              ...timetable,
              { id: newClientId(), time: ttTime, subject: subject.charAt(0).toUpperCase() + subject.slice(1) },
            ]);
            setTtSubject("");
          }}
        >
          <label className="text-sm">
            Time
            <input
              aria-label="Study time"
              type="time"
              className="input-dark w-auto"
              value={ttTime}
              onChange={(e) => setTtTime(e.target.value)}
            />
          </label>
          <label className="grow text-sm">
            Subject
            <input
              aria-label="Subject for the time table"
              className="input-dark"
              value={ttSubject}
              onChange={(e) => setTtSubject(e.target.value)}
              placeholder="e.g. Maths"
            />
          </label>
          <button type="submit" className="btn-primary">
            Add
          </button>
        </form>
        {ttError && (
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
            {ttError}
          </p>
        )}
      </section>

      {report.data && (
        <section className="panel px-4 py-4" aria-label="Padhai report for the last 7 days">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm neon-text">PADHAI REPORT — LAST 7 DAYS</h3>
            <button
              type="button"
              className="btn-ghost ml-auto text-xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(formatStudyReport(report.data!, false).text);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied!" : "Copy report"}
            </button>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {formatStudyReport(report.data, false).text}
          </p>
          <p className="mt-2 text-xs text-[var(--dim)]">
            Ask {BRAND.short} “meri padhai report batao” in chat or voice to hear it anytime.
          </p>
        </section>
      )}

      {(bootstrap.data?.announcements.length ?? 0) > 0 && (
        <section aria-label="Announcements" className="space-y-2">
          {bootstrap.data!.announcements.map((a) => (
            <div key={a.id} className="panel border-l-4 px-4 py-3" style={{ borderLeftColor: "var(--warn)" }}>
              <p className="font-display text-sm">{a.title}</p>
              <p className="text-sm text-[var(--dim)]">{a.body}</p>
            </div>
          ))}
        </section>
      )}

      <section aria-label="All tools">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <button
              key={t.page}
              type="button"
              onClick={() => go(t.page)}
              className="panel-raised px-3 py-4 text-left"
            >
              <span className="font-display block text-sm">{t.label}</span>
              <span className="mt-1 block text-xs text-[var(--dim)]">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel px-4 py-3" aria-label="Fact of the day">
        <h3 className="font-display text-xs tracking-widest neon-text">FACT OF THE DAY</h3>
        <p className="mt-1 text-sm leading-relaxed">{dailyFact()}</p>
      </section>

      {(leaderboard.data?.players.length ?? 0) > 0 && (
        <section className="panel px-4 py-4" aria-label="Top players">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm neon-text">TOP PLAYERS</h3>
            <button type="button" className="text-sm underline" onClick={() => go("leaderboard")}>
              Full leaderboard
            </button>
          </div>
          <ol className="mt-2 space-y-1 text-sm">
            {leaderboard.data!.players.slice(0, 3).map((p, i) => (
              <li key={p.displayName} className="flex justify-between">
                <span>
                  {i + 1}. {p.displayName}
                </span>
                <span className="neon-text">{p.total} pts</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <span className="hidden">{token ? "" : ""}</span>
    </div>
  );
}

// ---------------------------------------------------------------- Chat
type ChatMsg = {
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
  links?: Array<{ label: string; url: string }>;
  openPage?: Page;
  openLabel?: string;
};

// What the command router returns when it handles a request itself instead
// of sending it to the AI chat: the message to show, a shorter `speak`
// version for voice mode, and optional rich extras (picture, links, or a
// button / navigation to a feature page).
type CommandResult = {
  text: string;
  speak?: string;
  imageUrl?: string;
  links?: Array<{ label: string; url: string }>;
  openPage?: Page;
  openLabel?: string;
  navigate?: Page;
};

// Every feature page the assistant can open by name (typed or spoken).
const PAGE_TARGETS: Array<[RegExp, Page, string]> = [
  [/note/, "notes", "Notes"],
  [/reminder|to.?do/, "reminders", "Reminders"],
  [/quiz/, "quiz", "AI Quiz"],
  [/game/, "games", "Games"],
  [/leaderboard|top players/, "leaderboard", "Leaderboard"],
  [/news|khabar/, "news", "News"],
  [/weather|mausam/, "weather", "Weather"],
  [/crypto|bitcoin|coin/, "crypto", "Coin Prices"],
  [/cricket|score/, "cricket", "Cricket Scores"],
  [/music|gaana|song/, "music", "Music Maker"],
  [/dictionary|meaning/, "dictionary", "Dictionary"],
  [/translat/, "translate", "Translator"],
  [/focus|timer|pomodoro/, "focus", "Study Timer"],
  [/image|picture|photo|tasveer/, "image", "Make a Picture"],
  [/homework/, "homework", "Homework Help"],
  [/youtube|video summar/, "youtube", "Video Summary"],
  [/photo to text|ocr|image to text/, "ocr", "Photo to Text"],
  [/pdf/, "pdf", "Ask a PDF"],
  [/python/, "python", "Run Python"],
  [/code|coding/, "code", "Write Code"],
  [/qr/, "qr", "QR Codes"],
  [/shorten|short link/, "shortener", "Shorten a Link"],
  [/prompt/, "prompts", "Saved Prompts"],
  [/fact|joke/, "facts", "Facts & Jokes"],
  [/desktop|pc control/, "desktop", "Desktop Controls"],
  [/profile|account/, "profile", "Profile"],
  [/about/, "about", "About"],
  [/feedback/, "feedback", "Feedback"],
  [/install|setup|download/, "install", "Install & Setup"],
  [/dashboard|home/, "dashboard", "Home"],
];

const COMMAND_WORDS =
  /weather|mausam|मौसम|news|khabar|joke|fact|bitcoin|crypto|translate|meaning|define|note|remind|image|picture|photo|tasveer|search|quiz|homework|solve|open|kholo|time|date|timer|music|song|game|convert|currency|price|wikipedia|timetable|report/i;

// ------------------------------------------------- study time table helpers
// Shared by the Chat router (voice/typed setup + read-back) and the simple
// form on the Dashboard. Entries live in localStorage (offline-first, like
// notes/reminders), are mirrored into the user's prefs in compact form,
// and each entry is ALSO mirrored into Reminders for its next occurrence,
// so the existing reminders system surfaces study time like any other task.
function sortedTimetable(entries: TimetableEntry[]): TimetableEntry[] {
  return [...entries].sort((a, b) => a.time.localeCompare(b.time)).slice(0, 8);
}

function loadTimetable(prefValue: string | undefined): TimetableEntry[] {
  const local = localTimetable.all();
  if (local.length) return sortedTimetable(local);
  const fromPref = timetableFromPref(prefValue);
  if (fromPref.length) localTimetable.saveAll(fromPref);
  return sortedTimetable(fromPref);
}

function mirrorTimetableReminders(entries: TimetableEntry[], token?: string) {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const existing = localReminders.all();
  const additions: LocalReminder[] = [];
  for (const e of entries) {
    const [h = 0, mi = 0] = e.time.split(":").map(Number);
    const due = new Date(now);
    due.setHours(h, mi, 0, 0);
    if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
    const dueText = `${due.getFullYear()}-${p(due.getMonth() + 1)}-${p(due.getDate())}T${p(due.getHours())}:${p(due.getMinutes())}`;
    const text = `Study time: ${e.subject}`;
    if (!existing.some((r) => !r.deleted && r.text === text && r.dueText === dueText)) {
      additions.push({ clientId: newClientId(), text, dueText, done: false, updatedAt: Date.now() });
    }
  }
  if (!additions.length) return;
  const next = [...additions, ...existing];
  localReminders.saveAll(next);
  void api
    .syncReminders({
      token,
      reminders: next.map((r) => ({
        clientId: r.clientId,
        text: r.text,
        dueText: r.dueText,
        done: r.done,
        updatedAt: r.updatedAt,
        deleted: r.deleted ?? false,
      })),
    })
    .catch(() => undefined);
}

// ------------------------------------------------------- padhai report text
// One formatter for the weekly report, used by the chat/voice answer AND
// the Dashboard card (whose Copy button shares exactly this text).
type StudyReportData = ApiResponse<typeof api, "getStudyReport">;

function formatStudyReport(d: StudyReportData, hindi: boolean): { text: string; speak: string } {
  const fmtDay = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const range = `${fmtDay(d.weekStart)} – ${fmtDay(d.weekEnd)}`;
  const earned = d.badges.filter((b) => b.earned).map((b) => b.label);
  const quizLine = d.quizzesTaken
    ? hindi
      ? `• Quiz diye: ${d.quizzesTaken} — average score ${d.quizAvgPercent}%, best ${d.bestQuizPercent}%`
      : `• Quizzes taken: ${d.quizzesTaken} — average score ${d.quizAvgPercent}%, best ${d.bestQuizPercent}%`
    : hindi
      ? "• Quiz diye: 0 — chat mein “quiz” bolkar ek quiz try kijiye"
      : "• Quizzes taken: 0 — say “quiz” in chat to try one";
  const badgeLine = earned.length
    ? hindi
      ? `• Badges mile: ${earned.join(", ")}`
      : `• Badges earned: ${earned.join(", ")}`
    : hindi
      ? "• Badges: abhi koi nahi — 3 din ki streak par pehla badge milega"
      : "• Badges: none yet — a 3-day streak earns the first one";
  const lines = [
    hindi ? `Padhai Report — pichhle 7 din (${range})` : `Padhai Report — last 7 days (${range})`,
    hindi
      ? `• Padhai wale din: 7 mein se ${d.studyDays} (quiz ${d.quizDays} din · revision ${d.revisionDays} din)`
      : `• Study days: ${d.studyDays} of 7 (quiz days ${d.quizDays} · revision days ${d.revisionDays})`,
    quizLine,
    hindi
      ? `• Study streak: ${d.currentStreak} din (best ${d.bestStreak})`
      : `• Study streak: ${d.currentStreak} day${d.currentStreak === 1 ? "" : "s"} (best ${d.bestStreak})`,
    badgeLine,
  ];
  const speak = hindi
    ? `Aapki padhai report: pichhle 7 din mein ${d.studyDays} din padhai hui, ${d.quizzesTaken} quiz diye${d.quizzesTaken ? `, average score ${d.quizAvgPercent} percent` : ""}. Streak ${d.currentStreak} din ki hai.`
    : `Your study report: ${d.studyDays} study days this week, ${d.quizzesTaken} quizzes taken${d.quizzesTaken ? ` with an average score of ${d.quizAvgPercent} percent` : ""}. Your streak is ${d.currentStreak} days.`;
  return { text: lines.join("\n"), speak };
}

export function ChatPage({ token, user, go, refreshUser }: PageProps) {
  // Style and persona come from the user's saved preferences (Profile page).
  const mode = user.prefs.style || "normal";
  const persona = user.prefs.persona || "standard";
  const voiceName = user.prefs.voiceName ?? "";
  const [lang, setLang] = useState(user.prefs.language || "en-IN");
  const [voicePresetId, setVoicePresetId] = useState(
    () => VOICE_PRESETS.find((p) => p.id === user.prefs.voicePreset)?.id ?? DEFAULT_VOICE_PRESET,
  );
  useEffect(() => {
    setLang(user.prefs.language || "en-IN");
  }, [user.prefs.language]);
  useEffect(() => {
    setVoicePresetId(VOICE_PRESETS.find((p) => p.id === user.prefs.voicePreset)?.id ?? DEFAULT_VOICE_PRESET);
  }, [user.prefs.voicePreset]);
  const langName = languageNameFor(lang);
  const recLang = persona === "hinglish" ? "hi-IN" : lang;
  const speakOpts = { voiceName, lang, presetId: voicePresetId };
  // The voice loop (recognition callbacks, async speak chain) is created
  // once and keeps running across re-renders, so it must read the CURRENT
  // speak options from a ref — reading the render-scope `speakOpts`
  // instead was the bug where changing the voice style mid-conversation
  // changed nothing until the mode was restarted. With the ref, a new
  // style applies to the very next sentence Yukti speaks.
  const speakOptsRef = useRef(speakOpts);
  speakOptsRef.current = speakOpts;
  useVoices(); // warm up the device voice list early so the first spoken reply already sounds natural

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: `Hi ${user.displayName}, I'm ${BRAND.short} — your assistant. Ask me anything, or just say what you need: "weather in Delhi", "tell me a joke", "make a picture of a cat", "note: buy books", "open Quiz". Stuck on a question? Tap Photo below, send a picture of it, and I'll explain it step by step right here. I can chat and speak in many languages — pick yours from the Language menu above.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [wakeOn, setWakeOn] = useState(false);
  const [localError, setLocalError] = useState("");
  const [toolBusy, setToolBusy] = useState(false);
  // ---- Voice Assistant mode (Google Assistant style conversation loop)
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [liveText, setLiveText] = useState("");
  const voiceActiveRef = useRef(false);
  const voiceRecRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceStateRef = useRef<"idle" | "listening" | "thinking" | "speaking">("idle");
  const voiceTurnRef = useRef(0);
  const voiceRestartsRef = useRef(0);
  const voiceHandledRef = useRef(false);
  const userSpeechLangRef = useRef<string | null>(null); // adapts to the language the user actually speaks (hi-IN / en-IN)
  const endpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMsg[]>([]);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef<"weather" | "image" | "revision" | null>(null);
  const lastCityRef = useRef(""); // last weather city, reused by the Morning Briefing
  // ---- Study Revision session (conversational, in chat/voice)
  type RevisionSession = {
    questions: Array<{ question: string; answer: string }>;
    index: number;
    score: number;
    subject: string;
    hindi: boolean;
  };
  const revisionRef = useRef<RevisionSession | null>(null);
  const [revisionUi, setRevisionUi] = useState<{ index: number; total: number; score: number } | null>(null);
  // ---- Study Time Table (set/read from chat & voice; form lives on Home)
  const [timetable, setTimetable] = useState<TimetableEntry[]>(() => loadTimetable(user.prefs.timetable));
  // ---- Focus Music (built-in ambient loops, controlled from chat/voice)
  const focus = useFocusMusic();
  // ---- Doubt Camera: attach a photo of a question and Yukti solves it
  // step by step right here in the conversation (no separate page).
  const [photo, setPhoto] = useState<{ dataBase64: string; mimeType: string; preview: string; name: string } | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const prefill = takeChatPrefill();
    if (prefill) setInput(prefill);
    if (takeVoiceAutoStart()) startVoiceMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const setVoiceStateBoth = (s: "idle" | "listening" | "thinking" | "speaking") => {
    voiceStateRef.current = s;
    setVoiceState(s);
  };

  const pushMsg = (m: ChatMsg) => setMessages((prev) => [...prev, m]);

  const savePref = useMutation({
    mutationFn: (prefs: Record<string, string>) => api.savePrefs({ token, prefs }),
    onSuccess: () => refreshUser(),
    onError: (e) => setLocalError(e instanceof Error ? e.message : "Could not save that setting."),
  });

  function changeLang(code: string) {
    setLang(code);
    savePref.mutate({ language: code });
  }
  function changeVoicePreset(id: string) {
    setVoicePresetId(id);
    savePref.mutate({ voicePreset: id });
  }

  function persistTimetable(next: TimetableEntry[]) {
    const sorted = sortedTimetable(next);
    setTimetable(sorted);
    localTimetable.saveAll(sorted);
    mirrorTimetableReminders(sorted, token);
    savePref.mutate({ timetable: timetableToPref(sorted) });
  }

  const reply = useMutation({
    mutationFn: (args: { message: string; history: ChatMsg[] }) =>
      api.chatReply({
        token,
        message: args.message,
        mode: mode as "normal" | "detailed" | "short" | "developer",
        persona: persona as "standard" | "hinglish",
        language: langName,
        history: args.history.slice(-10).map((h) => ({ role: h.role, text: h.text })),
      }),
    onError: (e) => setLocalError(e instanceof Error ? e.message : "Chat failed. Try again."),
  });

  const busy = reply.isPending || toolBusy;

  // ============================================================ command router
  // One router for typed chat AND voice: if the request matches something
  // the app can actually do, do it and answer right here in the chat.
  // Returns null when nothing matched (the AI chat reply takes over).
  async function runCommand(rawInput: string): Promise<CommandResult | null> {
    const raw = rawInput.trim();
    const t = raw.toLowerCase();
    if (!raw) return null;
    const err = (e: unknown): CommandResult => ({
      text: e instanceof Error ? e.message : "Something went wrong with that. Please try again.",
    });

    // Follow-up answers ("Which city?" → "Delhi").
    if (pendingRef.current && !COMMAND_WORDS.test(t)) {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending === "weather") return weatherResult(raw);
      if (pending === "image") return imageResult(raw);
      if (pending === "revision") {
        return startRevision(raw, false, detectHindi(raw) || persona === "hinglish");
      }
    }

    // Focus Music — "focus music chalao", "padhai music lagao", "focus
    // music band karo". Built-in ambient loops, played right here; the
    // strip under the chat has the Stop button too.
    if (
      /\bfocus music\b/.test(t) ||
      (/\b(music|dhun|sangeet)\b/.test(t) && /\b(focus|padhai|study|concentration)\b/.test(t)) ||
      (focusMusic.isPlaying() && /\bmusic\b/.test(t) && /\b(stop|band|off)\b/.test(t))
    ) {
      const hindi = detectHindi(raw) || persona === "hinglish";
      if (/\b(stop|band|off|ruk)\b/.test(t)) {
        focusMusic.stop();
        return {
          text: hindi ? "Focus music band kar diya." : "Focus music stopped.",
          speak: hindi ? "Focus music band kar diya." : "Focus music stopped.",
        };
      }
      const style = /rain|baarish|barish|बारिश/.test(t) ? "rain" : "calm";
      focusMusic.start(style);
      return {
        text: hindi
          ? `Focus music chalu kar diya — ${style === "rain" ? "halki baarish wali dhun" : "shaant, halki dhun"}. Padhai par dhyaan dijiye; band karna ho to "focus music band karo" bol dijiye.`
          : `Focus music is on — ${style === "rain" ? "soft rain sounds" : "calm, quiet pads"}. Say "stop focus music" anytime to turn it off.`,
        speak: hindi ? "Focus music chalu kar diya hai." : "Focus music is on.",
      };
    }

    // Study Time Table — set by talking ("roz 5 baje maths, 6 baje
    // science"), read back ("mera time table batao"), or cleared. Checked
    // before the clock branch below, which would otherwise grab "baje".
    const mentionsTimetable = /time\s?table|timetable|समय सारणी/.test(t);
    if (mentionsTimetable || (/\broz\b/.test(t) && /\d{1,2}(:\d{2})?\s*(baje|am|pm|बजे)/.test(t))) {
      const hindi = detectHindi(raw) || persona === "hinglish";
      if (/\b(clear|delete|hata|remove|saaf|mita)\b/.test(t)) {
        persistTimetable([]);
        return {
          text: hindi ? "Time table saaf kar diya." : "Your study time table is cleared.",
          speak: hindi ? "Time table saaf kar diya." : "Your study time table is cleared.",
        };
      }
      const entries = parseTimetableEntries(raw);
      if (entries.length) {
        const merged = [...timetable];
        for (const e of entries) {
          if (!merged.some((x) => x.time === e.time && x.subject.toLowerCase() === e.subject.toLowerCase())) {
            merged.push(e);
          }
        }
        persistTimetable(merged);
        const list = sortedTimetable(merged)
          .map((e) => `${formatTime12h(e.time)} — ${e.subject}`)
          .join("\n");
        return {
          text: hindi
            ? `Time table set ho gaya — har time ke liye Reminders mein reminder bhi bana diya hai:\n${list}`
            : `Study time table saved — each time is also in your Reminders:\n${list}`,
          speak: hindi ? "Time table set ho gaya hai." : "Your study time table is saved.",
          openPage: "reminders",
          openLabel: "Open Reminders",
        };
      }
      if (timetable.length) {
        const list = timetable.map((e) => `${formatTime12h(e.time)} — ${e.subject}`).join("\n");
        return {
          text: `${hindi ? "Aapka study time table:" : "Your study time table:"}\n${list}`,
          speak: hindi
            ? `Aapka time table: ${timetable.map((e) => `${formatTime12h(e.time)} ${e.subject}`).join(", ")}.`
            : `Your time table: ${timetable.map((e) => `${e.subject} at ${formatTime12h(e.time)}`).join(", ")}.`,
        };
      }
      return {
        text: hindi
          ? "Aapka time table abhi khaali hai. Bas aise bol dijiye: “roz 5 baje Maths, 6 baje Science” — main bana dungi. Home page par form se bhi bana sakte hain."
          : "Your time table is empty. Just say: “roz 5 baje Maths, 6 baje Science” and I'll set it up — or use the form on the Home page.",
        speak: hindi ? "Time table khaali hai. Samay aur subject bol dijiye, main bana dungi." : "Your time table is empty. Tell me the times and subjects and I'll set it up.",
      };
    }

    // Padhai Report — "meri padhai report batao", "weekly study report":
    // the last 7 days of study days, quizzes and scores, streak and
    // badges, all computed on the server from real recorded activity.
    if (/(padhai report|study report|weekly report|meri report|my progress|study progress|report card|hafta.*report)/.test(t)) {
      try {
        const d = await api.getStudyReport({ token, day: localDayString() });
        const hindi = detectHindi(raw) || persona === "hinglish";
        const r = formatStudyReport(d, hindi);
        return { text: r.text, speak: r.speak, openPage: "dashboard", openLabel: "Open Home (full report)" };
      } catch (e) {
        return err(e);
      }
    }

    // "open Notes", "kholo quiz", "start music" → go straight to the page.
    const openMatch = t.match(/^(?:please\s+)?(?:open|show|go to|start|launch|kholo|chalao|dikhao)\s+(?:the\s+)?(.+)/);
    if (openMatch) {
      const hit = PAGE_TARGETS.find(([re]) => re.test((openMatch[1] ?? "").trim()));
      if (hit) {
        return { text: `Opening ${hit[2]}.`, speak: `Opening ${hit[2]}.`, navigate: hit[1] };
      }
    }

    // Time and date — answered instantly on the device.
    if (/\b(time|samay|baje)\b/.test(t) && !/timer/.test(t)) {
      const nowStr = new Date().toLocaleTimeString(recLang, { hour: "numeric", minute: "2-digit" });
      return {
        text: `It's ${nowStr} right now.`,
        speak: persona === "hinglish" ? `Abhi samay hai ${nowStr}.` : `It's ${nowStr} right now.`,
      };
    }
    if (/\b(date|tarikh)\b/.test(t) || (/\b(day|aaj)\b/.test(t) && /(what|which|kya|kaun|today)/.test(t))) {
      const dateStr = new Date().toLocaleDateString(recLang, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return {
        text: `Today is ${dateStr}.`,
        speak: persona === "hinglish" ? `Aaj hai ${dateStr}.` : `Today is ${dateStr}.`,
      };
    }

    // Morning Briefing — "meri subah ki briefing do", "good morning briefing":
    // weather + top news + fact of the day + exam countdown, in one answer.
    if (/\bbriefing\b/.test(t) || /^good morning/.test(t) || /subah ki/.test(t) || /\bsuprabhat\b/.test(t)) {
      return briefingResult(raw);
    }

    // Weather — "weather in Delhi", "Delhi ka mausam", "मौसम".
    if (/\b(weather|mausam|मौसम)\b/.test(t)) {
      const city = extractCity(raw);
      if (!city) {
        pendingRef.current = "weather";
        return { text: "Sure — which city's weather do you want? Just say or type the city name.", speak: "Which city's weather do you want?" };
      }
      return weatherResult(city);
    }

    // Translate — "translate good morning to Hindi".
    const trMatch = raw.match(/translate\s+(.+?)\s+(?:in|into|to)\s+([a-zA-Z ]+)$/i);
    if (trMatch) {
      const target = findLanguageName((trMatch[2] ?? "").trim());
      if (target) {
        try {
          const d = await api.translateText({ token, text: (trMatch[1] ?? "").trim(), targetLanguage: target });
          return { text: `${target}: ${d.translation}`, speak: d.translation };
        } catch (e) {
          return err(e);
        }
      }
    }
    if (/^translate\b/i.test(t)) {
      const rest = raw.replace(/^translate\s*/i, "").trim();
      if (rest && langName !== "English") {
        try {
          const d = await api.translateText({ token, text: rest, targetLanguage: langName });
          return { text: `${langName}: ${d.translation}`, speak: d.translation };
        } catch (e) {
          return err(e);
        }
      }
      return { text: `Tell me like this: "translate good morning to Hindi" — I can translate into ${ASSISTANT_LANGUAGES.map((l) => l.englishName).filter((v, i, a) => a.indexOf(v) === i).join(", ")} and more.` };
    }

    // Currency — "100 dollars to rupees", "convert 50 USD in INR".
    const curMatch = t.match(
      /(?:convert\s+)?(\d[\d,]*(?:\.\d+)?)\s*(usd|inr|eur|gbp|aed|dollars?|rupees?|pounds?|euros?|dirhams?|rs\.?|₹|\$|€|£)?\s*(?:to|in|=|mein|me)\s*(usd|inr|eur|gbp|aed|dollars?|rupees?|pounds?|euros?|dirhams?)/,
    );
    if (curMatch && /\b(convert|currency|exchange|to|in)\b/.test(t)) {
      const amount = parseFloat((curMatch[1] ?? "0").replace(/,/g, ""));
      const from = currencyCode(curMatch[2] ?? "usd");
      const to = currencyCode(curMatch[3] ?? "");
      if (amount > 0 && to) {
        try {
          const d = await api.convertCurrency({ token, amount, from, to });
          const line = `${amount} ${from} = ${d.result} ${to}`;
          return { text: `${line} (rate: 1 ${from} = ${d.rate} ${to})`, speak: line };
        } catch (e) {
          return err(e);
        }
      }
    }

    // Pictures — "make an image of a robot", "draw a cat", "ek photo banao".
    if (
      (/\b(image|picture|photo|tasveer|drawing|painting|तस्वीर)\b/.test(t) &&
        /\b(make|create|generate|draw|paint|bana|banao|show|dikha|chahiye)\b/.test(t)) ||
      /^(draw|paint)\s/.test(t)
    ) {
      const prompt = cleanImagePrompt(raw);
      if (prompt.length < 3) {
        pendingRef.current = "image";
        return { text: "Sure — what picture should I make? Describe it in a few words.", speak: "What picture should I make?" };
      }
      return imageResult(prompt);
    }

    // Notes — "note: buy books tomorrow" / "note down …" (a bare "note" only
    // counts with a colon/dash, so "note that…" in normal chat is untouched).
    const noteMatch =
      raw.match(/^(?:please\s+)?(?:note down|note karo|note kar lo|save (?:a\s+)?note|write (?:a\s+)?note)\s*[:\-]?\s+(.+)/is) ??
      raw.match(/^(?:please\s+)?note\s*[:\-]\s*(.+)/is);
    if (noteMatch) {
      const text = (noteMatch[1] ?? "").trim();
      if (text) {
        const all = localNotes.all();
        const next = [
          { clientId: newClientId(), title: text.slice(0, 60), body: text, updatedAt: Date.now() },
          ...all,
        ];
        localNotes.saveAll(next);
        void api
          .syncNotes({
            token,
            notes: next.map((n) => ({ clientId: n.clientId, title: n.title, body: n.body, updatedAt: n.updatedAt, deleted: n.deleted ?? false })),
          })
          .catch(() => undefined);
        return {
          text: `Saved to your notes: "${text}"`,
          speak: "Saved to your notes.",
          openPage: "notes",
          openLabel: "Open Notes",
        };
      }
    }

    // Reminders — "remind me at 6 to study", "kal 6 baje padhai ke liye
    // yaad dilana". Saved into the same Reminders area the app already has,
    // and confirmed back in the user's own language.
    const hindiReminder = /yaad dila/.test(t);
    const remMatch = raw.match(/^(?:please\s+)?(?:remind me|set (?:a\s+)?reminder|reminder)\s*[:\-]?\s*(?:to\s+)?(.+)/is);
    if (hindiReminder || remMatch) {
      const dueRe =
        /\b(kal|aaj|parso|tomorrow|today)?\s*(subah|shaam|raat)?\s*\d{1,2}(?::\d{2})?\s*(?:baje|am|pm)\b|\b(kal|aaj|parso|tomorrow|today)\b|\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i;
      let text = "";
      let due = "";
      if (hindiReminder) {
        due = raw.match(dueRe)?.[0]?.trim() ?? "";
        text = raw
          .replace(/^hey\s+yukti[,\s]*/i, "")
          .replace(/yaad dila(na|o|do|dena)?/gi, "")
          .replace(/\bke liye\b/gi, "")
          .replace(dueRe, "")
          .replace(/^mujhe\s+/i, "")
          .replace(/\s+/g, " ")
          .replace(/[.\s]+$/g, "")
          .trim();
      } else if (remMatch) {
        const full = (remMatch[1] ?? "").trim();
        due = full.match(dueRe)?.[0]?.trim() ?? "";
        text = (due ? full.replace(dueRe, "") : full)
          .replace(/^\s*to\s+/i, "")
          .replace(/\s+/g, " ")
          .replace(/[.\s]+$/g, "")
          .trim();
        if (!text) text = full;
      }
      if (text) {
        const all = localReminders.all();
        const next = [
          { clientId: newClientId(), text, dueText: due, done: false, updatedAt: Date.now() },
          ...all,
        ];
        localReminders.saveAll(next);
        void api
          .syncReminders({
            token,
            reminders: next.map((r) => ({ clientId: r.clientId, text: r.text, dueText: r.dueText, done: r.done, updatedAt: r.updatedAt, deleted: r.deleted ?? false })),
          })
          .catch(() => undefined);
        const hindi = hindiReminder || detectHindi(raw);
        return {
          text: hindi
            ? `Theek hai, reminder bana diya: "${text}"${due ? ` — ${due}` : ""}. Ye aapko Reminders mein mil jayega.`
            : `Done — reminder saved: "${text}"${due ? ` (${due})` : ""}. You'll find it in Reminders.`,
          speak: hindi
            ? `Theek hai, reminder bana diya hai: ${text}${due ? `, ${due}` : ""}.`
            : `Done. Reminder saved: ${text}${due ? `, ${due}` : ""}.`,
          openPage: "reminders",
          openLabel: "Open Reminders",
        };
      }
    }

    // Homework — "solve 2x + 3 = 7" / "homework: …".
    const hwMatch = raw.match(/^(?:please\s+)?(?:solve|homework)\s*[:\-]?\s+(.+)/is);
    if (hwMatch) {
      try {
        const d = await api.solveHomework({ token, question: (hwMatch[1] ?? "").trim(), level: user.prefs.level || "Class 10" });
        const steps = d.steps.length ? `\n\nSteps:\n${d.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "";
        return { text: `${d.answer}${steps}`, speak: d.answer };
      } catch (e) {
        return err(e);
      }
    }

    // Dictionary — "meaning of serendipity", "define photosynthesis", "X ka matlab".
    const dictMatch =
      t.match(/(?:meaning of|define|definition of)\s+([a-zA-Z][a-zA-Z'-]*)/) ??
      t.match(/([a-zA-Z][a-zA-Z'-]*)\s+(?:ka matlab|ka arth|meaning)/);
    if (dictMatch) {
      try {
        const d = await api.dictionaryLookup({ token, word: dictMatch[1] ?? "" });
        if (!d.found) return { text: `I couldn't find "${dictMatch[1]}" in the dictionary. Check the spelling and try again.` };
        const lines = d.meanings.slice(0, 3).map((m) => `• (${m.partOfSpeech}) ${m.definition}${m.example ? ` — e.g. "${m.example}"` : ""}`);
        const syn = d.synonyms.length ? `\nSimilar words: ${d.synonyms.slice(0, 6).join(", ")}` : "";
        return {
          text: `${d.word}${d.phonetic ? ` (${d.phonetic})` : ""}\n${lines.join("\n")}${syn}`,
          speak: `${d.word}. ${d.meanings[0]?.definition ?? ""}`,
        };
      } catch (e) {
        return err(e);
      }
    }

    // Wikipedia — "who is APJ Abdul Kalam", "tell me about the moon".
    const wikiMatch = raw.match(/(?:who is|who was|tell me about|wikipedia(?:\s+for)?|search wikipedia for)\s+(.+)/i);
    if (wikiMatch) {
      const topic = (wikiMatch[1] ?? "").replace(/[?.\s]+$/, "").trim();
      if (topic) {
        try {
          const d = await api.wikipediaLookup({ token, topic });
          if (!d.found) return { text: `I couldn't find a Wikipedia page for "${topic}".` };
          const extract = d.extract.length > 700 ? `${d.extract.slice(0, 700)}…` : d.extract;
          return {
            text: `${d.title}\n${extract}`,
            speak: d.extract.slice(0, 320),
            links: d.url ? [{ label: "Read on Wikipedia", url: d.url }] : [],
          };
        } catch (e) {
          return err(e);
        }
      }
    }

    // Web / YouTube search — "search for black holes", "search YouTube for lofi music".
    const searchMatch = raw.match(/^(?:please\s+)?(?:search(?:\s+for)?|google|look\s+up)\s+(.+)/i);
    if (searchMatch || (/\byoutube\b/.test(t) && /\b(search|find|dikha|show)\b/.test(t))) {
      const query = (searchMatch?.[1] ?? raw).replace(/\b(on\s+)?youtube\b/i, "").replace(/[?\s]+$/, "").trim();
      if (query.length >= 2) {
        try {
          const d = await api.webSearch({ token, query, youtube: /\byoutube\b/.test(t) });
          if (!d.results.length) return { text: `No results found for "${query}".` };
          const top = d.results.slice(0, 5);
          return {
            text: `Here's what I found for "${query}":\n${top.map((r, i) => `${i + 1}. ${r.title}`).join("\n")}`,
            speak: `Top result: ${top[0]?.title ?? ""}`,
            links: top.filter((r) => r.url).map((r) => ({ label: r.title, url: r.url as string })),
          };
        } catch (e) {
          return err(e);
        }
      }
    }

    // News — "news", "tech news", "khabar sunao".
    if (/\b(news|headlines|khabar|khabrein|samachar|समाचार|खबर)\b/.test(t)) {
      const category = /tech/.test(t)
        ? "technology"
        : /sport/.test(t)
          ? "sport"
          : /business/.test(t)
            ? "business"
            : /health/.test(t)
              ? "health"
              : /world/.test(t)
                ? "world"
                : "top";
      try {
        const d = await api.getNews({ token, category: category as "top" | "world" | "technology" | "business" | "sport" | "health" });
        const top = d.items.slice(0, 5);
        return {
          text: `Top headlines:\n${top.map((n, i) => `${i + 1}. ${n.title}`).join("\n")}`,
          speak: `Here are the top headlines. ${top.slice(0, 3).map((n) => n.title).join(". ")}`,
          links: top.map((n) => ({ label: n.title, url: n.link })),
        };
      } catch (e) {
        return err(e);
      }
    }

    // Jokes and facts.
    if (/\b(joke|chutkula|चुटकुला|make me laugh|hasao)\b/.test(t)) {
      try {
        const d = await api.getFactOrJoke({ token, kind: "joke" });
        return { text: d.text, speak: d.text };
      } catch (e) {
        return err(e);
      }
    }
    if (/\b(fact|interesting|rochak)\b/.test(t) && /\b(fact|tell|sunao|batao|give|interesting|rochak)\b/.test(t)) {
      try {
        const d = await api.getFactOrJoke({ token, kind: "fact" });
        return { text: d.text, speak: d.text };
      } catch (e) {
        return err(e);
      }
    }

    // Coin prices — "bitcoin price", "crypto prices".
    if (/\b(bitcoin|btc|ethereum|eth\b|solana|dogecoin|crypto|coin price)\b/.test(t)) {
      try {
        const d = await api.getCrypto({ token });
        const wanted = /bitcoin|btc/.test(t)
          ? "Bitcoin"
          : /ethereum|eth\b/.test(t)
            ? "Ethereum"
            : /solana/.test(t)
              ? "Solana"
              : /dogecoin/.test(t)
                ? "Dogecoin"
                : "";
        const one = wanted ? d.coins.find((c) => c.name === wanted) : undefined;
        if (one) {
          const line = `${one.name} is at $${one.usd.toLocaleString()} (₹${one.inr.toLocaleString()}), ${one.change24h >= 0 ? "up" : "down"} ${Math.abs(one.change24h)}% in 24 hours.`;
          return { text: line, speak: line };
        }
        return {
          text: `Live coin prices:\n${d.coins.map((c) => `• ${c.name}: $${c.usd.toLocaleString()} (₹${c.inr.toLocaleString()}) · ${c.change24h >= 0 ? "+" : ""}${c.change24h}% today`).join("\n")}`,
          speak: `Bitcoin is at $${d.coins[0]?.usd.toLocaleString() ?? ""} dollars.`,
        };
      } catch (e) {
        return err(e);
      }
    }

    // Study Revision — "science ka revision karo", "revision from my notes":
    // starts a spoken/typed question-answer session right here in the chat.
    if (/\b(revision|revise)\b/.test(t)) {
      const hindi = detectHindi(raw) || persona === "hinglish";
      if (/(notes?\s+se|from my notes|mere notes|my notes)/.test(t)) {
        return startRevision("My Notes", true, hindi);
      }
      return startRevision(extractSubject(t), false, hindi);
    }

    // Feature pages that work best opened (quiz, music, timer, cricket, games).
    if (/\b(quiz|test me|practice questions)\b/.test(t)) {
      return { text: "Let's do a quiz — pick your class and subject, and I'll ask the questions.", speak: "Opening the quiz.", openPage: "quiz", openLabel: "Start a quiz" };
    }
    if (/\b(music|song|gaana|gana)\b/.test(t) && /\b(make|play|create|compose|sunao|bajao|chahiye)\b/.test(t)) {
      return { text: "Opening the Music Maker — pick a style and tempo there and your tune plays instantly.", speak: "Opening the Music Maker.", openPage: "music", openLabel: "Open Music Maker" };
    }
    if (/\b(timer|pomodoro|focus)\b/.test(t)) {
      return { text: "Opening the Study Timer.", speak: "Opening the Study Timer.", openPage: "focus", openLabel: "Open Study Timer" };
    }
    if (/\b(cricket|live score|match score)\b/.test(t)) {
      return { text: "Opening Cricket Scores.", speak: "Opening Cricket Scores.", openPage: "cricket", openLabel: "Open Cricket Scores" };
    }
    if (/\b(game|games|khelo|play)\b/.test(t) && /\b(game|games|khelo|play)\b/.test(t)) {
      return { text: "Opening Games — Snake, Memory Match, Tic-Tac-Toe and more. Scores go to the leaderboard!", speak: "Opening Games.", openPage: "games", openLabel: "Open Games" };
    }

    return null;
  }

  async function briefingResult(rawText: string): Promise<CommandResult> {
    const hindi = detectHindi(rawText) || persona === "hinglish";
    const dateStr = new Date().toLocaleDateString(recLang, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const lines: string[] = [
      hindi
        ? `Suprabhat, ${user.displayName}! Aaj hai ${dateStr}. Ye rahi aapki subah ki briefing:`
        : `Good morning, ${user.displayName}! Today is ${dateStr}. Here's your morning briefing:`,
    ];
    const speakParts: string[] = [
      hindi ? `Suprabhat! Aaj hai ${dateStr}.` : `Good morning! Today is ${dateStr}.`,
    ];
    const links: Array<{ label: string; url: string }> = [];

    const city = lastCityRef.current || user.prefs.city || "";
    if (city) {
      try {
        const w = await api.getWeather({ token, city });
        if (w.found) {
          lines.push(`Weather in ${w.place}: ${w.condition}, ${Math.round(w.temp)}°C (humidity ${w.humidity}%, wind ${w.wind} km/h).`);
          speakParts.push(
            hindi
              ? `${w.place} mein mausam ${w.condition} hai, taapmaan ${Math.round(w.temp)} degree.`
              : `In ${w.place}, it's ${w.condition} at ${Math.round(w.temp)} degrees.`,
          );
        }
      } catch {
        /* weather line is optional in a briefing */
      }
    } else {
      lines.push(
        hindi
          ? "Mausam: apna sheher ek baar bata dijiye — jaise “Delhi ka mausam” — phir main har briefing mein mausam bhi shamil kar dungi."
          : "Weather: tell me your city once — like “weather in Delhi” — and I'll include it in every briefing.",
      );
    }

    try {
      const n = await api.getNews({ token, category: "top" });
      const top3 = n.items.slice(0, 3);
      if (top3.length) {
        lines.push(`${hindi ? "Badi khabrein" : "Top news"}:\n${top3.map((x, i) => `${i + 1}. ${x.title}`).join("\n")}`);
        speakParts.push(`${hindi ? "Badi khabrein" : "Top headlines"}: ${top3.map((x) => x.title).join(". ")}`);
        for (const x of top3) links.push({ label: x.title, url: x.link });
      }
    } catch {
      /* news line is optional in a briefing */
    }

    try {
      const f = await api.getFactOrJoke({ token, kind: "fact" });
      lines.push(`${hindi ? "Aaj ka fact" : "Fact of the day"}: ${f.text}`);
      speakParts.push(`${hindi ? "Aaj ka fact" : "Fact of the day"}: ${f.text}`);
    } catch {
      lines.push(`Fact of the day: ${dailyFact()}`);
      speakParts.push(`Fact of the day: ${dailyFact()}`);
    }

    const examDate = user.prefs.examDate ?? "";
    if (examDate) {
      const target = new Date(`${examDate}T00:00:00`);
      if (!Number.isNaN(target.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Math.round((target.getTime() - today.getTime()) / 86400000);
        if (days >= 0) {
          const examLine =
            days === 0
              ? hindi
                ? "Aaj aapka exam hai — all the best!"
                : "Your exam is today — all the best!"
              : `${user.prefs.examName ? `${user.prefs.examName}: ` : "Exam: "}${days} ${hindi ? "din bache hain" : `day${days === 1 ? "" : "s"} left`}.`;
          lines.push(examLine);
          speakParts.push(examLine);
        }
      }
    }

    return { text: lines.join("\n\n"), speak: speakParts.join(" "), links };
  }

  async function weatherResult(city: string): Promise<CommandResult> {
    try {
      const d = await api.getWeather({ token, city });
      if (!d.found) {
        pendingRef.current = "weather";
        return { text: `I couldn't find a place called "${city}". Try another city name.`, speak: "I couldn't find that city. Try another name." };
      }
      const today = d.days[0];
      // Remember the city so the Morning Briefing can include the weather.
      lastCityRef.current = d.place;
      void api.savePrefs({ token, prefs: { city: d.place } }).catch(() => undefined);
      const text = `Weather in ${d.place}, ${d.country}: ${d.condition}, ${Math.round(d.temp)}°C. Humidity ${d.humidity}%, wind ${d.wind} km/h.${today ? `\nToday: ${Math.round(today.min)}°–${Math.round(today.max)}°C.` : ""}`;
      return { text, speak: `In ${d.place}, it's ${d.condition} and ${Math.round(d.temp)} degrees.` };
    } catch (e) {
      return { text: e instanceof Error ? e.message : "Weather is unavailable right now." };
    }
  }

  async function imageResult(prompt: string): Promise<CommandResult> {
    try {
      const d = await api.generateImage({ token, prompt, orientation: "square" });
      return {
        text: `Here's your picture: "${prompt}"`,
        speak: "Here's your picture.",
        imageUrl: d.url,
        links: [{ label: "Download picture", url: d.url }],
      };
    } catch (e) {
      return { text: e instanceof Error ? e.message : "Picture making failed. Try again." };
    }
  }

  // ============================================================ Study Revision
  // A spoken/typed question-answer session run entirely inside the chat:
  // Yukti asks one question at a time, checks the answer conversationally,
  // and ends with a small score summary. No screens, just talk.
  function syncRevisionUi() {
    const r = revisionRef.current;
    setRevisionUi(r ? { index: r.index, total: r.questions.length, score: r.score } : null);
  }

  function extractSubject(text: string): string {
    const subjects: Array<[RegExp, string]> = [
      [/social science|sst/, "Social Science"],
      [/mathematics|maths|math/, "Maths"],
      [/science/, "Science"],
      [/english/, "English"],
      [/hindi/, "Hindi"],
      [/history/, "History"],
      [/geography/, "Geography"],
      [/civics/, "Civics"],
      [/physics/, "Physics"],
      [/chemistry/, "Chemistry"],
      [/biology/, "Biology"],
      [/computer/, "Computer Science"],
    ];
    const hit = subjects.find(([re]) => re.test(text));
    if (hit) return hit[1];
    const m = text.match(/(?:revision|revise)(?:\s+of|\s+for|\s+ka|\s+ki)?\s+([a-zA-Z ]{3,30})/);
    const guess = (m?.[1] ?? "").replace(/\b(mode|session|please|karo|karna|hai)\b/gi, "").trim();
    return guess ? guess.charAt(0).toUpperCase() + guess.slice(1) : "";
  }

  async function startRevision(subjectRaw: string, fromNotes: boolean, hindi: boolean): Promise<CommandResult> {
    const subject = fromNotes ? "My Notes" : subjectRaw.trim();
    if (!subject) {
      pendingRef.current = "revision";
      return {
        text: hindi
          ? "Bilkul! Kaunsi subject ka revision karein — Science, Maths, English, Hindi ya Social Science? Bas subject ka naam bol dijiye. Ya “mere notes se revision” bhi bol sakte hain."
          : "Sure! Which subject should we revise — Science, Maths, English, Hindi or Social Science? Just say the subject name. You can also say “revision from my notes”.",
        speak: hindi ? "Kaunsi subject ka revision karein?" : "Which subject should we revise?",
      };
    }
    try {
      let material = "";
      if (fromNotes) {
        material = localNotes
          .all()
          .filter((n) => !n.deleted)
          .map((n) => `${n.title}: ${n.body}`)
          .join("\n")
          .slice(0, 3500);
        if (!material) {
          return {
            text: hindi
              ? "Aapke notes mein abhi kuch hai hi nahi. Pehle kuch notes bana lijiye, phir unse revision karenge."
              : "Your notes are empty right now. Add some notes first, then we'll revise from them.",
          };
        }
      }
      const d = await api.generateRevisionSet({
        token,
        level: user.prefs.level || "Class 10",
        subject,
        count: 5,
        material: material || undefined,
      });
      if (!d.questions.length) {
        return { text: hindi ? "Sawal nahi ban paye. Ek baar phir try kijiye." : "I couldn't make questions just now. Please try again." };
      }
      revisionRef.current = { questions: d.questions, index: 0, score: 0, subject, hindi };
      syncRevisionUi();
      const first = d.questions[0]!;
      const intro = hindi
        ? `Revision shuru karte hain — ${subject}, kul ${d.questions.length} sawal. Bas jawab bol ya likh dijiye; rukna ho to "band karo" bol dijiye.`
        : `Let's revise ${subject} — ${d.questions.length} quick questions. Just say or type each answer; say "stop" anytime to end.`;
      return {
        text: `${intro}\n\nQuestion 1: ${first.question}`,
        speak: `${intro} Question 1. ${first.question}`,
      };
    } catch (e) {
      return { text: e instanceof Error ? e.message : "Revision couldn't start. Please try again." };
    }
  }

  function answersMatch(userAns: string, correct: string): boolean {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\u0900-\u097F ]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    const u = norm(userAns);
    const c = norm(correct);
    if (!u || !c) return false;
    if (u === c || u.includes(c) || c.includes(u)) return true;
    const words = c.split(" ").filter((w) => w.length > 2);
    if (!words.length) return false;
    const uWords = u.split(" ");
    const hits = words.filter((w) => uWords.includes(w)).length;
    return hits / words.length >= 0.6;
  }

  function endRevision(): CommandResult {
    const r = revisionRef.current;
    revisionRef.current = null;
    syncRevisionUi();
    if (!r) return { text: "Revision ended." };
    const summary = r.hindi
      ? `Revision ruk gaya. Aapne ${r.questions.length} mein se ${r.index} sawal kiye, score ${r.score}. Jab chaaho, bas "revision" bolkar phir shuru kar sakte ho.`
      : `Revision stopped. You answered ${r.index} of ${r.questions.length} questions, score ${r.score}. Say "revision" anytime to start again.`;
    return { text: summary, speak: summary };
  }

  function handleRevisionAnswer(rawText: string): CommandResult {
    const r = revisionRef.current;
    if (!r) return { text: "Revision is not running." };
    const current = r.questions[r.index];
    if (!current) return endRevision();
    if (isStopCommand(rawText) || /^(end|band|stop|ruk)/i.test(rawText.trim())) {
      return endRevision();
    }
    let feedback: string;
    if (/\b(nahi pata|pata nahi|nahi aata|don'?t know|skip|pass)\b/i.test(rawText)) {
      feedback = r.hindi
        ? `Koi baat nahi — sahi jawab hai: ${current.answer}.`
        : `No problem — the correct answer is: ${current.answer}.`;
    } else if (answersMatch(rawText, current.answer)) {
      r.score += 1;
      feedback = r.hindi ? `Bilkul sahi! ${current.answer}.` : `Correct! ${current.answer}.`;
    } else {
      feedback = r.hindi
        ? `Bilkul sahi nahi — sahi jawab hai: ${current.answer}.`
        : `Not quite — the correct answer is: ${current.answer}.`;
    }
    r.index += 1;
    if (r.index >= r.questions.length) {
      const total = r.questions.length;
      const score = r.score;
      const hindi = r.hindi;
      // A finished revision session counts toward the study streak —
      // recorded on the server, exactly like a submitted quiz.
      void api
        .completeRevision({ token, day: localDayString(), subject: r.subject, total, score })
        .catch(() => undefined);
      revisionRef.current = null;
      syncRevisionUi();
      const praise =
        score === total
          ? hindi
            ? "Perfect score! Taiyaari ekdum solid hai."
            : "Perfect score! Your preparation is solid."
          : score >= Math.ceil(total / 2)
            ? hindi
              ? "Bahut badhiya! Thodi aur practice aur perfect ho jayega."
              : "Great job! A little more practice and you'll ace it."
            : hindi
              ? "Achha prayas! Ye topics notes se ek baar aur padh lijiye, phir dobara try kijiye."
              : "Good try! Read these topics once more and try again.";
      const summary = hindi
        ? `Revision khatm — aapka score: ${total} mein se ${score}. ${praise}`
        : `Revision complete — you scored ${score} out of ${total}. ${praise}`;
      return { text: `${feedback}\n\n${summary}`, speak: `${feedback} ${summary}` };
    }
    syncRevisionUi();
    const next = r.questions[r.index]!;
    return {
      text: `${feedback}\n\nQuestion ${r.index + 1}: ${next.question}`,
      speak: `${feedback} Question ${r.index + 1}. ${next.question}`,
    };
  }

  function extractCity(text: string): string {    const clean = (s: string) =>
      s.replace(/\b(today|now|please|batao|sunao|ka|ke|ki)\b/gi, "").replace(/[?.!\s]+$/g, "").trim();
    const m1 = text.match(/(?:weather|mausam|मौसम)\s+(?:in|of|for|at)\s+([a-zA-Z][a-zA-Z\s.'-]*)/i);
    if (m1?.[1]) return clean(m1[1]);
    const m2 = text.match(/([a-zA-Z][a-zA-Z\s.'-]*?)\s+(?:ka|ke|ki|mein|me)\s+(?:weather|mausam|मौसम)/i);
    if (m2?.[1]) return clean(m2[1]);
    const m3 = text.match(/(?:in|of|for)\s+([a-zA-Z][a-zA-Z\s.'-]*)/i);
    if (m3?.[1]) return clean(m3[1]);
    return "";
  }

  function cleanImagePrompt(text: string): string {
    return text
      .replace(/^(please\s+)?(make|create|generate|draw|paint|show(?:\s+me)?|bana[oa]?|dikha[oa]?)\s+(me\s+)?(a\s+|an\s+|the\s+|ek\s+)?(image|picture|photo|drawing|painting|tasveer|तस्वीर)?\s*(of\s+|ek\s+)?/i, "")
      .replace(/^(of\s+)/i, "")
      .replace(/[?.!\s]+$/g, "")
      .trim();
  }

  function findLanguageName(word: string): string {
    const w = word.toLowerCase().replace(/[^a-z]/g, "");
    const hit = ASSISTANT_LANGUAGES.find((l) => l.englishName.toLowerCase() === w);
    return hit ? hit.englishName : "";
  }

  function currencyCode(word: string): string {
    const w = word.toLowerCase();
    if (/usd|dollar|\$/.test(w)) return "USD";
    if (/inr|rupee|rs|₹/.test(w)) return "INR";
    if (/eur|euro|€/.test(w)) return "EUR";
    if (/gbp|pound|£/.test(w)) return "GBP";
    if (/aed|dirham/.test(w)) return "AED";
    return w.toUpperCase();
  }

  // The whole point of this page: you send a message, Yukti replies — and if
  // you asked for something the app can do, she does it right here.
  async function handleSend(raw?: string) {
    const text = (raw ?? input).trim();
    if (busy || (!text && !photo)) return;
    setLocalError("");
    setInput("");
    // Doubt Camera: a photo attached to the message is solved right here
    // in the conversation, step by step, in the chat's language.
    if (photo) {
      const p = photo;
      setPhoto(null);
      pushMsg({
        role: "user",
        text: text || "Please explain this question step by step.",
        imageUrl: p.preview,
      });
      setToolBusy(true);
      try {
        const d = await api.solveHomework({
          token,
          question: text,
          image: { dataBase64: p.dataBase64, mimeType: p.mimeType },
          level: user.prefs.level || "Class 10",
          language: langName,
        });
        const steps = d.steps.length
          ? `\n\nSteps:\n${d.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
          : "";
        pushMsg({ role: "assistant", text: `${d.answer}${steps}` });
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : "Couldn't read that photo. Try a clearer one.");
      }
      setToolBusy(false);
      return;
    }
    pushMsg({ role: "user", text });
    setToolBusy(true);
    // During a revision session, every message is an answer to the current
    // question (or a stop phrase) — it never goes to the normal router.
    if (revisionRef.current) {
      const res = handleRevisionAnswer(text);
      setToolBusy(false);
      pushMsg({ role: "assistant", text: res.text });
      return;
    }
    let cmd: CommandResult | null = null;
    try {
      cmd = await runCommand(text);
    } catch {
      cmd = null;
    }
    setToolBusy(false);
    if (cmd) {
      pushMsg({
        role: "assistant",
        text: cmd.text,
        imageUrl: cmd.imageUrl,
        links: cmd.links,
        openPage: cmd.navigate ? undefined : cmd.openPage,
        openLabel: cmd.openLabel,
      });
      if (cmd.navigate) go(cmd.navigate);
      return;
    }
    reply.mutate(
      { message: text, history: messages },
      { onSuccess: (d) => pushMsg({ role: "assistant", text: d.reply }) },
    );
  }

  // ============================================================ Voice Assistant mode
  // The loop: listen → user speaks → Yukti thinks → Yukti speaks the reply →
  // listen again, hands-free, until the user taps End or says "stop".
  // Speed choices: single-utterance recognition (final result fires as soon
  // as the user pauses), an endpoint timer that cuts long silences short,
  // short spoken replies, and a small history window.
  function stopVoiceRecognition() {
    if (endpointTimerRef.current) {
      clearTimeout(endpointTimerRef.current);
      endpointTimerRef.current = null;
    }
    const rec = voiceRecRef.current;
    voiceRecRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  function startVoiceListening() {
    if (!voiceActiveRef.current) return;
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setLocalError("Voice Assistant needs speech recognition, which this browser doesn't support. Try Chrome on Android or desktop.");
      endVoiceMode(false);
      return;
    }
    stopVoiceRecognition();
    stopSpeaking();
    const rec = new Ctor();
    rec.lang = userSpeechLangRef.current ?? recLang;
    rec.interimResults = true;
    rec.continuous = false; // one utterance per turn → the final result (and the reply) comes fast
    voiceHandledRef.current = false;
    rec.onresult = (e) => {
      voiceRestartsRef.current = 0;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        const heard = r[0].transcript;
        if (r.isFinal) {
          if (!voiceHandledRef.current && heard.trim()) {
            voiceHandledRef.current = true;
            if (endpointTimerRef.current) clearTimeout(endpointTimerRef.current);
            setLiveText("");
            void processVoiceCommand(heard);
            return;
          }
        } else {
          interim += heard;
        }
      }
      if (interim) {
        setLiveText(interim);
        // Endpointing: if the user has paused for a moment with words on
        // screen, stop now instead of waiting for the browser's own
        // (slower) silence timeout — stopping delivers the final result.
        // 350 ms keeps the gap between "user stops talking" and "Yukti
        // starts answering" as small as recognition allows.
        if (endpointTimerRef.current) clearTimeout(endpointTimerRef.current);
        endpointTimerRef.current = setTimeout(() => {
          if (voiceRecRef.current === rec && !voiceHandledRef.current) {
            try {
              rec.stop();
            } catch {
              /* already stopped */
            }
          }
        }, 350);
      }
    };
    rec.onend = () => {
      if (endpointTimerRef.current) {
        clearTimeout(endpointTimerRef.current);
        endpointTimerRef.current = null;
      }
      // Recognition ended with nothing heard (short silence): restart it
      // while we are still supposed to be listening — but bail out if it
      // keeps failing, e.g. the mic permission was denied.
      if (voiceActiveRef.current && voiceStateRef.current === "listening" && voiceRecRef.current === rec && !voiceHandledRef.current) {
        voiceRestartsRef.current += 1;
        if (voiceRestartsRef.current > 8) {
          setLocalError("The microphone stopped responding. Check the mic permission for this site, then start Voice Assistant again.");
          endVoiceMode(false);
          return;
        }
        voiceRecRef.current = null;
        startVoiceListening();
      }
    };
    rec.onerror = () => {
      /* onend handles the restart / bail-out logic */
    };
    voiceRecRef.current = rec;
    setVoiceStateBoth("listening");
    try {
      rec.start();
    } catch {
      /* already running */
    }
  }

  // Speaks a reply sentence by sentence: the first sentence starts the
  // moment the reply arrives, each next sentence follows immediately, and
  // if the user interrupts (the turn changes) the rest is never spoken.
  async function speakChunked(text: string, turn: number) {
    const chunks =
      text.match(/[^.!?…।]+[.!?…।]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
    for (const chunk of chunks) {
      if (!voiceActiveRef.current || voiceTurnRef.current !== turn) return;
      await speakAsync(chunk, { ...speakOptsRef.current, lang: speechLangFor(chunk, speakOptsRef.current.lang) });
    }
  }

  async function speakAndContinue(result: CommandResult | string) {
    const turn = voiceTurnRef.current;
    const cmd: CommandResult = typeof result === "string" ? { text: result } : result;
    pushMsg({
      role: "assistant",
      text: cmd.text,
      imageUrl: cmd.imageUrl,
      links: cmd.links,
      openPage: cmd.openPage,
      openLabel: cmd.openLabel,
    });
    setVoiceStateBoth("speaking");
    await speakChunked(cmd.speak ?? cmd.text, turn);
    if (!voiceActiveRef.current || voiceTurnRef.current !== turn) return;
    startVoiceListening();
  }

  async function processVoiceCommand(rawText: string) {
    const text = rawText.trim();
    if (!voiceActiveRef.current) return;
    if (!text) {
      startVoiceListening();
      return;
    }
    stopVoiceRecognition();
    pushMsg({ role: "user", text });
    // Remember the language this user actually speaks in, so the next
    // listening round and the spoken reply match it (Hindi ↔ English).
    userSpeechLangRef.current = detectHindi(text) ? "hi-IN" : recLang;
    // During a revision session, everything spoken is an answer to the
    // current question — "band karo" ends the revision, not the voice chat.
    if (revisionRef.current) {
      setVoiceStateBoth("thinking");
      const res = handleRevisionAnswer(text);
      await speakAndContinue(res);
      return;
    }
    if (isStopCommand(text)) {
      endVoiceMode(true);
      return;
    }
    setVoiceStateBoth("thinking");

    // The same router as typed chat: weather, news, pictures, notes,
    // reminders, prices, meanings, jokes… all work by voice too.
    let cmd: CommandResult | null = null;
    try {
      cmd = await runCommand(text);
    } catch {
      cmd = null;
    }
    if (!voiceActiveRef.current) return;
    if (cmd) {
      const target = cmd.navigate ?? cmd.openPage;
      if (target) {
        const turn = voiceTurnRef.current;
        pushMsg({ role: "assistant", text: cmd.text });
        setVoiceStateBoth("speaking");
        await speakChunked(cmd.speak ?? cmd.text, turn);
        if (voiceTurnRef.current === turn) {
          endVoiceMode(false);
          go(target);
        }
        return;
      }
      await speakAndContinue(cmd);
      return;
    }

    try {
      const d = await api.voiceChatReply({
        token,
        message: text,
        persona: persona as "standard" | "hinglish",
        language: langName,
        history: messagesRef.current.slice(-4).map((h) => ({ role: h.role, text: h.text })),
      });
      if (!voiceActiveRef.current) return;
      await speakAndContinue(d.reply);
    } catch (e) {
      if (!voiceActiveRef.current) return;
      setLocalError(e instanceof Error ? e.message : "Voice reply failed.");
      await speakAndContinue(
        persona === "hinglish"
          ? "Sorry, kuch gadbad ho gayi. Ek baar phir boliye."
          : "Sorry, something went wrong. Please say that again.",
      );
    }
  }

  function startVoiceMode(initialCommand?: string) {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setLocalError("Voice Assistant needs speech recognition, which this browser doesn't support. Try Chrome on Android or desktop.");
      return;
    }
    if (!("speechSynthesis" in window)) {
      setLocalError("This browser can't speak replies aloud, so Voice Assistant mode isn't available here.");
      return;
    }
    setLocalError("");
    setWakeOn(false);
    recogRef.current?.stop();
    setListening(false);
    stopSpeaking();
    voiceTurnRef.current += 1;
    voiceRestartsRef.current = 0;
    voiceActiveRef.current = true;
    setVoiceMode(true);
    // Instant reaction: the orb is on screen and the earcon sounds in the
    // same moment the wake word lands, and listening starts NOW — the old
    // flow first spoke a full greeting sentence and only then opened the
    // mic, which felt like Yukti ignoring you for two seconds. The
    // greeting is still shown, as text.
    playEarcon();
    if (initialCommand && initialCommand.trim()) {
      setVoiceStateBoth("thinking");
      void processVoiceCommand(initialCommand);
      return;
    }
    const greet =
      persona === "hinglish" ? "Haan, boliye. Main sun rahi hoon." : `Hi ${user.displayName}, I'm listening.`;
    pushMsg({ role: "assistant", text: greet });
    startVoiceListening();
  }

  function endVoiceMode(sayBye: boolean) {
    voiceTurnRef.current += 1;
    voiceActiveRef.current = false;
    revisionRef.current = null;
    setRevisionUi(null);
    stopVoiceRecognition();
    setVoiceMode(false);
    setVoiceStateBoth("idle");
    setLiveText("");
    if (sayBye) {
      const bye =
        persona === "hinglish"
          ? "Theek hai, main rukti hoon. Dobara baat karne ke liye Hey Yukti boliye ya Voice Assistant button dabaiye."
          : "Okay, stopping here. Say Hey Yukti or tap Voice Assistant whenever you want to talk again.";
      pushMsg({ role: "assistant", text: bye });
      void speakAsync(bye, { ...speakOptsRef.current, lang: speechLangFor(bye, speakOptsRef.current.lang) });
    } else {
      stopSpeaking();
    }
  }

  function interruptSpeaking() {
    if (voiceStateRef.current !== "speaking") return;
    voiceTurnRef.current += 1;
    stopSpeaking();
    startVoiceListening();
  }

  // Stop all voice activity when leaving the page.
  useEffect(() => {
    return () => {
      voiceActiveRef.current = false;
      stopVoiceRecognition();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- voice input (single dictation; final results only, appended once)
  function toggleDictation() {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setLocalError("Voice input is not supported in this browser. Try Chrome on desktop or Android.");
      return;
    }
    stopSpeaking(); // avoid the mic hearing Yukti's own voice
    const rec = new Ctor();
    rec.lang = recLang;
    rec.interimResults = false;
    rec.continuous = false;
    let handled = false;
    rec.onresult = (e) => {
      if (handled) return;
      const last = e.results[e.results.length - 1];
      if (last?.isFinal) {
        handled = true;
        const transcript = last[0].transcript.trim();
        if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogRef.current = rec;
    setListening(true);
    rec.start();
  }

  // ---- wake word ("Hey Yukti") — continuous listening while the toggle is
  // on and this app is open on screen. When the phrase is heard, Voice
  // Assistant mode takes over; a command spoken right after the phrase
  // ("Hey Yukti, what's the time?") is answered immediately.
  useEffect(() => {
    if (!wakeOn) {
      wakeRef.current?.stop();
      wakeRef.current = null;
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setLocalError("The wake word needs speech recognition, which this browser doesn't support.");
      setWakeOn(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = persona === "hinglish" || lang === "hi-IN" ? "hi-IN" : "en-IN";
    rec.interimResults = true;
    rec.continuous = true;
    const customPhrase = user.prefs.wakePhrase || BRAND.defaultWakePhrase;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const heard = e.results[i]?.[0].transcript ?? "";
        const m = matchWakePhrase(heard, customPhrase);
        if (m.matched) {
          setWakeOn(false);
          startVoiceMode(m.command || undefined);
          return;
        }
      }
    };
    rec.onend = () => {
      if (wakeRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* already stopped */
        }
      }
    };
    wakeRef.current = rec;
    try {
      rec.start();
    } catch {
      /* ignore */
    }
    return () => {
      if (wakeRef.current === rec) wakeRef.current = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeOn]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={voiceMode ? "btn-ghost" : "btn-primary"}
          aria-pressed={voiceMode}
          onClick={() => (voiceMode ? endVoiceMode(false) : startVoiceMode())}
        >
          {voiceMode ? "End voice chat" : "Talk to Yukti (voice)"}
        </button>
        {!voiceMode && (
          <button
            type="button"
            className="btn-ghost"
            aria-pressed={wakeOn}
            onClick={() => setWakeOn((v) => !v)}
          >
            {wakeOn ? `Stop listening for “${user.prefs.wakePhrase || BRAND.defaultWakePhrase}”` : `Listen for “${user.prefs.wakePhrase || BRAND.defaultWakePhrase}”`}
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-[var(--dim)]">
          Language
          <select
            aria-label="Assistant language"
            className="input-dark w-auto"
            value={lang}
            onChange={(e) => changeLang(e.target.value)}
          >
            {ASSISTANT_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {wakeOn && !voiceMode && (
        <p className="flex items-center gap-2 text-sm neon-text">
          <span className="dot-live" /> Listening… say “{user.prefs.wakePhrase || BRAND.defaultWakePhrase}” to start talking.
          <span className="text-[var(--dim)]">(Works only while this app is open on screen.)</span>
        </p>
      )}

      {voiceMode && (
        <section className="panel px-4 py-5 text-center" aria-label="Voice Assistant">
          <button
            type="button"
            className="block mx-auto rounded-full"
            aria-label={voiceState === "speaking" ? "Interrupt Yukti and speak" : "Voice Assistant is active"}
            onClick={interruptSpeaking}
          >
            <div className={`reactor ${voiceState === "listening" || voiceState === "speaking" ? "listening" : ""}`} aria-hidden="true" />
          </button>
          <p className="font-display neon-text mt-4 text-lg" role="status">
            {voiceState === "listening" && (persona === "hinglish" ? "Sun rahi hoon… boliye" : "Listening… go ahead")}
            {voiceState === "thinking" && (persona === "hinglish" ? "Soch rahi hoon…" : "Thinking…")}
            {voiceState === "speaking" && (persona === "hinglish" ? "Yukti bol rahi hai…" : "Yukti is speaking…")}
            {voiceState === "idle" && "Voice Assistant"}
          </p>
          {liveText && voiceState === "listening" && (
            <p className="mt-2 text-sm text-[var(--dim)]" aria-label="What Yukti is hearing">
              “{liveText}”
            </p>
          )}
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--dim)]">
            Just keep talking — Yukti listens again after every reply. Ask for weather, news, a
            picture, a note… or say “stop” to end.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {voiceState === "speaking" && (
              <button type="button" className="btn-ghost" onClick={interruptSpeaking}>
                Interrupt &amp; speak
              </button>
            )}
            <button type="button" className="btn-primary" onClick={() => endVoiceMode(true)}>
              End conversation
            </button>
            <label className="flex items-center gap-2 text-sm text-[var(--dim)]">
              Voice
              <select
                aria-label="Voice style"
                className="input-dark w-auto"
                value={voicePresetId}
                onChange={(e) => changeVoicePreset(e.target.value)}
              >
                {VOICE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {focus.playing && (
        <div className="panel flex flex-wrap items-center gap-2 px-3 py-2 text-sm" role="status">
          <span className="dot-live" aria-hidden="true" />
          <span>Focus music playing — {focus.style === "rain" ? "soft rain" : "calm pads"}</span>
          <button type="button" className="btn-ghost ml-auto text-xs" onClick={() => focusMusic.stop()}>
            Stop music
          </button>
        </div>
      )}

      {revisionUi && (
        <div className="panel flex flex-wrap items-center gap-2 px-3 py-2 text-sm" role="status">
          <span className="dot-live" aria-hidden="true" />
          <span>
            Padhai Revision — Question {Math.min(revisionUi.index + 1, revisionUi.total)} of {revisionUi.total} · Score: {revisionUi.score}
          </span>
          <button
            type="button"
            className="btn-ghost ml-auto text-xs"
            onClick={() => pushMsg({ role: "assistant", text: endRevision().text })}
          >
            End revision
          </button>
        </div>
      )}

      <div ref={scrollRef} className="panel max-h-[56vh] space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className="inline-block max-w-[92%] whitespace-pre-wrap px-3 py-2 text-left text-sm leading-relaxed"
              style={{
                background: m.role === "user" ? "var(--surface2)" : "#07182b",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <span className="mb-1 block text-xs font-semibold tracking-wide text-[var(--dim)]">
                {m.role === "user" ? "You" : BRAND.short}
              </span>
              {m.text}
              {m.imageUrl && (
                <img
                  src={m.imageUrl}
                  alt={m.text}
                  className="mt-2 w-full max-w-xs rounded-lg border border-[var(--border)]"
                />
              )}
              {m.links && m.links.length > 0 && (
                <span className="mt-2 flex flex-wrap gap-2">
                  {m.links.map((l) => (
                    <a
                      key={l.url + l.label}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost text-xs"
                      style={{ minHeight: "2rem" }}
                    >
                      {l.label.length > 42 ? `${l.label.slice(0, 42)}…` : l.label}
                    </a>
                  ))}
                </span>
              )}
              {m.openPage && (
                <span className="mt-2 block">
                  <button type="button" className="btn-primary text-xs" onClick={() => go(m.openPage as Page)}>
                    {m.openLabel ?? "Open"}
                  </button>
                </span>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-[var(--dim)]">{BRAND.short} is typing…</p>}
      </div>

      {localError && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {localError}
        </p>
      )}

      {photo && !voiceMode && (
        <div className="panel flex items-center gap-3 px-3 py-2">
          <img
            src={photo.preview}
            alt="Your question photo"
            className="h-12 w-12 shrink-0 rounded-lg border border-[var(--border)] object-cover"
          />
          <span className="min-w-0 grow text-sm">
            Photo attached — tap Send and {BRAND.short} will solve it step by step here.
          </span>
          <button type="button" className="btn-ghost text-xs" onClick={() => setPhoto(null)}>
            Remove
          </button>
        </div>
      )}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        aria-label="Attach a photo of your question"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const payload = await fileToBase64Payload(f);
            setPhoto({ ...payload, preview: URL.createObjectURL(f), name: f.name });
            setLocalError("");
          } catch {
            setLocalError("Could not read that photo. Try another one.");
          }
        }}
      />

      {voiceMode ? (
        <p className="panel px-3 py-2 text-center text-sm text-[var(--dim)]">
          You're talking to {BRAND.short}. End the conversation to type instead.
        </p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <label className="sr-only" htmlFor="chat-input">
            Message {BRAND.short}
          </label>
          <input
            id="chat-input"
            className="input-dark grow"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            {...FIELDS.chatReply.message}
          />
          <button
            type="button"
            className="btn-ghost"
            aria-label="Attach a photo of a question for Yukti to solve"
            onClick={() => photoInputRef.current?.click()}
          >
            Photo
          </button>
          <button
            type="button"
            className="btn-ghost"
            aria-label={listening ? "Stop voice typing" : "Type with your voice"}
            aria-pressed={listening}
            onClick={toggleDictation}
          >
            {listening ? "Stop" : "Mic"}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || (!input.trim() && !photo)}>
            Send
          </button>
        </form>
      )}
      {listening && !voiceMode && (
        <p className="flex items-center gap-2 text-sm neon-text">
          <span className="dot-live" /> Listening… speak now and your words will appear in the box.
        </p>
      )}
    </div>
  );
}
