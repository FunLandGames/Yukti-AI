// Profile, About, Feedback, Install & Setup, and the Admin area.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { api } from "./api";
import type { PageProps } from "./appctx";
import { ASSISTANT_LANGUAGES, BRAND, DEFAULT_VOICE_PRESET, VOICE_PRESETS, localDayString, speakAsync, speechLangFor, useVoices } from "./lib";
import { firebaseFreshIdToken, firebaseResendVerification } from "./firebase";

const FIELDS = actionFields<typeof Actions>();

// ---------------------------------------------------------------- Profile
export function ProfilePage({ token, user, refreshUser }: PageProps) {
  const queryClient = useQueryClient();
  const voices = useVoices();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [code, setCode] = useState("");
  const [voiceName, setVoiceName] = useState(user.prefs.voiceName ?? "");
  const [voicePresetId, setVoicePresetId] = useState(
    () => VOICE_PRESETS.find((p) => p.id === user.prefs.voicePreset)?.id ?? DEFAULT_VOICE_PRESET,
  );
  const [language, setLanguage] = useState(user.prefs.language || "en-IN");
  const [style, setStyle] = useState(user.prefs.style || "normal");
  const [persona, setPersona] = useState(user.prefs.persona || "standard");
  const [wakePhrase, setWakePhrase] = useState(user.prefs.wakePhrase || BRAND.defaultWakePhrase);
  const [examName, setExamName] = useState(user.prefs.examName ?? "");
  const [examDate, setExamDate] = useState(user.prefs.examDate ?? "");
  const [stars, setStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const myReview = useQuery({
    queryKey: ["my-review"],
    queryFn: () => api.getMyReview({ token }),
  });
  const streak = useQuery({
    queryKey: ["study-streak"],
    queryFn: () => api.getStudyStreak({ token, day: localDayString() }),
  });
  const briefingStatus = useQuery({
    queryKey: ["todays-briefing"],
    queryFn: () => api.getTodaysBriefing({ token, day: localDayString() }),
  });
  const [briefingTime, setBriefingTime] = useState(user.prefs.briefingTime || "07:00");
  const saveBriefing = useMutation({
    mutationFn: (prefs: Record<string, string>) => api.savePrefs({ token, prefs }),
    onSuccess: () => {
      setMsg("Morning briefing setting saved.");
      refreshUser();
      void queryClient.invalidateQueries({ queryKey: ["todays-briefing"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save the briefing setting."),
  });

  const updateName = useMutation({
    mutationFn: () => api.updateProfile({ token, displayName: displayName.trim() }),
    onSuccess: () => {
      setMsg("Display name updated.");
      refreshUser();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not update."),
  });
  const verify = useMutation({
    mutationFn: () => api.verifyEmail({ token, code: code.trim() }),
    onSuccess: () => {
      setMsg("Email verified. Thank you!");
      refreshUser();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Verification failed."),
  });
  const fbResend = useMutation({
    mutationFn: () => firebaseResendVerification(),
    onSuccess: (ok) =>
      ok
        ? setMsg("Firebase sent the verification email again. Check your inbox.")
        : setError("No active Firebase session in this browser — sign out and sign in again, then resend."),
    onError: () => setError("Could not resend the verification email."),
  });
  const fbCheck = useMutation({
    mutationFn: async () => {
      const idToken = await firebaseFreshIdToken();
      if (!idToken) {
        throw new Error("No active Firebase session in this browser. Sign out and sign in again with Firebase, then check.");
      }
      return api.refreshFirebaseVerification({ token, idToken });
    },
    onSuccess: (d) => {
      if (d.emailVerified) {
        setMsg("Email verified with Firebase. Thank you!");
        refreshUser();
      } else {
        setError("Firebase still shows this email as unverified. Open the link in the verification email first.");
      }
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Verification check failed."),
  });
  const savePrefs = useMutation({
    mutationFn: () =>
      api.savePrefs({
        token,
        prefs: { voiceName, voicePreset: voicePresetId, language, style, persona, wakePhrase, examName, examDate },
      }),
    onSuccess: () => {
      setMsg("Assistant preferences saved.");
      refreshUser();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save preferences."),
  });
  const review = useMutation({
    mutationFn: () => api.submitReview({ token, stars, text: reviewText.trim() }),
    onSuccess: () => {
      setMsg("Review submitted — thank you!");
      void queryClient.invalidateQueries({ queryKey: ["my-review"] });
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not submit the review."),
  });

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Profile</h2>
      {msg && <p className="panel px-4 py-2 text-sm" style={{ color: "var(--good)" }}>{msg}</p>}
      {error && (
        <p role="alert" className="panel px-4 py-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>
      )}

      <section className="panel space-y-3 px-4 py-4" aria-label="Account details">
        <p className="text-sm">
          Signed in as <strong>{user.email}</strong> · Role:{" "}
          <strong className="neon-text">{user.role}</strong> (checked on the server) · Email:{" "}
          {user.emailVerified ? "verified" : "not verified"}
        </p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            updateName.mutate();
          }}
        >
          <label className="grow text-sm">
            Display name (shown on the leaderboard)
            <input aria-label="Display name" className="input-dark" value={displayName} onChange={(e) => setDisplayName(e.target.value)} {...FIELDS.updateProfile.displayName} />
          </label>
          <button type="submit" className="btn-primary" disabled={updateName.isPending || displayName.trim().length < 2}>
            Save name
          </button>
        </form>
        {!user.emailVerified && user.authProvider === "firebase" && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--dim)]">
              This account uses Firebase Authentication. Firebase emailed you a verification link at sign-up —
              open it, then check here. Your app data (reviews, scores, notes) is tied to your Firebase account.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => { setError(""); fbResend.mutate(); }} disabled={fbResend.isPending}>
                Resend verification email
              </button>
              <button type="button" className="btn-primary" onClick={() => { setError(""); fbCheck.mutate(); }} disabled={fbCheck.isPending}>
                {fbCheck.isPending ? "Checking with Firebase…" : "I've verified — check now"}
              </button>
            </div>
          </div>
        )}
        {!user.emailVerified && user.authProvider !== "firebase" && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              verify.mutate();
            }}
          >
            <label className="grow text-sm">
              Email verification code
              <input aria-label="Email verification code" className="input-dark" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code shown at sign-up" {...FIELDS.verifyEmail.code} />
            </label>
            <button type="submit" className="btn-ghost" disabled={verify.isPending || code.trim().length < 4}>
              Verify email
            </button>
          </form>
        )}
        {user.authProvider === "firebase" && (
          <p className="text-xs text-[var(--dim)]">
            Signed in with Firebase Authentication — password and verification are handled by Firebase; this app only stores your display name, preferences, reviews, scores and notes against your Firebase UID.
          </p>
        )}
      </section>

      <section className="panel space-y-3 px-4 py-4" aria-label="Study streak and badges">
        <h3 className="font-display text-sm neon-text">STUDY STREAK &amp; BADGES</h3>
        {streak.data ? (
          <>
            <p className="text-sm">
              Current streak:{" "}
              <strong className="neon-text">
                {streak.data.currentStreak} day{streak.data.currentStreak === 1 ? "" : "s"}
              </strong>{" "}
              · Best: {streak.data.bestStreak} day{streak.data.bestStreak === 1 ? "" : "s"} ·{" "}
              {streak.data.totalDays} study days in total
            </p>
            <p className="text-sm text-[var(--dim)]">
              {streak.data.studiedToday
                ? "You've already studied today — the streak is safe. Come back tomorrow to grow it."
                : "Finish a quiz or a revision session today to keep the streak growing."}
            </p>
            <div className="flex flex-wrap gap-2">
              {streak.data.badges.map((b) => (
                <span
                  key={b.id}
                  className="panel-raised px-3 py-2 text-xs"
                  style={b.earned ? { color: "var(--warn)", borderColor: "var(--warn)" } : { color: "var(--dim)" }}
                >
                  {b.earned ? `Badge earned: ${b.label}` : `${b.label} — at ${b.days} days`}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--dim)]">Loading your streak…</p>
        )}
      </section>

      <section className="panel space-y-3 px-4 py-4" aria-label="Morning briefing schedule">
        <h3 className="font-display text-sm neon-text">MORNING BRIEFING (SUBAH KI BRIEFING)</h3>
        <p className="text-sm text-[var(--dim)]">
          Pick a time and Yukti prepares your briefing — weather, top news, Aaj Ka Fact and your exam
          countdown — for that time every day, so it's ready the moment you open the app.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Briefing time
            <input
              type="time"
              aria-label="Morning briefing time"
              className="input-dark w-auto"
              value={briefingTime}
              onChange={(e) => setBriefingTime(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={saveBriefing.isPending || !/^\d{2}:\d{2}$/.test(briefingTime)}
            onClick={() => {
              setError("");
              saveBriefing.mutate({
                briefingTime,
                briefingTzOffset: String(-new Date().getTimezoneOffset()),
              });
            }}
          >
            {user.prefs.briefingTime ? "Save new time" : "Turn on daily briefing"}
          </button>
          {user.prefs.briefingTime && (
            <button
              type="button"
              className="btn-ghost"
              disabled={saveBriefing.isPending}
              onClick={() => {
                setError("");
                saveBriefing.mutate({ briefingTime: "" });
              }}
            >
              Turn off
            </button>
          )}
        </div>
        <p className="text-sm text-[var(--dim)]" role="status">
          {briefingStatus.data?.status === "ready" &&
            "Today's briefing is ready — it's waiting for you on the Home page."}
          {briefingStatus.data?.status === "scheduled" &&
            `On: today's briefing will be ready at ${briefingStatus.data.briefingTime}.`}
          {briefingStatus.data?.status === "not-set" &&
            "Off right now — set a time above to switch it on."}
        </p>
      </section>

      <section className="panel space-y-3 px-4 py-4" aria-label="Assistant preferences">
        <h3 className="font-display text-sm neon-text">ASSISTANT PREFERENCES</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="text-sm sm:col-span-2">
            <span>Voice — tap Listen to hear each one before you choose</span>
            <div className="mt-1 space-y-2" role="radiogroup" aria-label="Voice style">
              {VOICE_PRESETS.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  style={{
                    borderColor: voicePresetId === p.id ? "var(--accent)" : "var(--border)",
                    background: voicePresetId === p.id ? "var(--surface2)" : undefined,
                  }}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={voicePresetId === p.id}
                    className="grow text-left"
                    onClick={() => {
                      setVoicePresetId(p.id);
                      // Choosing a style clears the exact-voice override
                      // below — while an exact voice was set, it silently
                      // won over every style and switching styles changed
                      // nothing.
                      setVoiceName("");
                    }}
                  >
                    <span className="block font-medium">
                      {p.label}
                      {p.id === DEFAULT_VOICE_PRESET ? " (default)" : ""}
                    </span>
                    <span className="block text-xs text-[var(--dim)]">{p.hint}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    aria-label={`Listen to the ${p.label} voice demo`}
                    onClick={() =>
                      // The demo previews the STYLE itself, never the
                      // exact-voice override — otherwise every demo plays
                      // in the same voice and the styles sound identical.
                      void speakAsync(p.demo, { voiceName: "", lang: speechLangFor(p.demo, "en-IN"), presetId: p.id })
                    }
                  >
                    Listen
                  </button>
                </div>
              ))}
            </div>
          </div>
          <label className="text-sm">
            Speech voice (optional exact voice — overrides the styles above)
            <select aria-label="Speech voice" className="input-dark" value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
              <option value="">Auto — best voice for the style</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-[var(--dim)]">
              Leave this on Auto to use the voice styles. Picking one exact voice here makes every style
              speak in that voice, so the styles stop sounding different.
            </span>
          </label>
          <label className="text-sm">
            Language
            <select aria-label="Assistant language" className="input-dark" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {ASSISTANT_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Response style
            <select aria-label="Response style" className="input-dark" value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="detailed">Detailed</option>
              <option value="short">Short</option>
              <option value="developer">Developer</option>
            </select>
          </label>
          <label className="text-sm">
            Persona
            <select aria-label="Assistant persona" className="input-dark" value={persona} onChange={(e) => setPersona(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="hinglish">Hinglish (Hindi-English mix)</option>
            </select>
          </label>
          <label className="text-sm">
            Wake phrase
            <input aria-label="Wake phrase" className="input-dark" value={wakePhrase} onChange={(e) => setWakePhrase(e.target.value)} />
          </label>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setError(""); savePrefs.mutate(); }} disabled={savePrefs.isPending}>
          Save preferences
        </button>
        <p className="text-xs text-[var(--dim)]">
          Each voice style uses the softest, most human-sounding voice installed on this device for
          your language (Natural/Neural voices sound best). Tip: on Android, install a Google voice
          for your language in system Text-to-speech settings for an even more human voice.
        </p>
        <p className="text-xs text-[var(--dim)]">
          Default wake word: “Hey Yukti”. It listens only while you switch it on in the Chat page and the
          app is open on screen — a web app can't listen after it's closed or the phone is locked. When
          Yukti hears it, Voice Assistant mode opens and starts a hands-free conversation.
        </p>
      </section>

      <section className="panel space-y-3 px-4 py-4" aria-label="Exam countdown settings">
        <h3 className="font-display text-sm neon-text">EXAM COUNTDOWN</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Exam name
            <input aria-label="Exam name" className="input-dark" value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. Class 10 Boards" />
          </label>
          <label className="text-sm">
            Exam date
            <input aria-label="Exam date" type="date" className="input-dark" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </label>
        </div>
        <button type="button" className="btn-ghost" onClick={() => { setError(""); savePrefs.mutate(); }} disabled={savePrefs.isPending}>
          Save exam date
        </button>
        <p className="text-xs text-[var(--dim)]">Your dashboard will count down the days.</p>
      </section>

      <section className="panel space-y-3 px-4 py-4" aria-label="Your review">
        <h3 className="font-display text-sm neon-text">YOUR REVIEW</h3>
        {myReview.data?.review ? (
          <p className="text-sm">
            You rated {BRAND.name} {"★".repeat(myReview.data.review.stars)} — “{myReview.data.review.text}”
            <span className="block text-xs text-[var(--dim)]">One review per account, so it can't be changed. Reviews with 3–5 stars appear on the sign-in page.</span>
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              review.mutate();
            }}
          >
            <label className="block text-sm">
              Stars
              <select aria-label="Star rating" className="input-dark" value={stars} onChange={(e) => setStars(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((s) => (
                  <option key={s} value={s}>{"★".repeat(s)} ({s})</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Your review
              <textarea aria-label="Your review" className="input-dark" rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)} {...FIELDS.submitReview.text} placeholder="What do you think of Yukti AI?" />
            </label>
            <button type="submit" className="btn-primary" disabled={review.isPending || reviewText.trim().length < 3}>
              Submit my one review
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- About
export function AboutPage() {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">About {BRAND.name}</h2>
      <section className="panel px-4 py-4 text-sm leading-relaxed">
        <p>
          <strong>{BRAND.name}</strong> is a personal AI command centre created by{" "}
          <strong>{BRAND.creator}</strong>: chat with modes and voice, a homework solver, quizzes that earn real
          leaderboard points, study tools, games, and everyday utilities — all in one lightweight, dark,
          JARVIS-inspired hub.
        </p>
        <p className="mt-3">
          It is designed to stay fast on modest hardware — including an old Windows 7 PC with an AMD Athlon 64 3800+
          and 5 GB RAM — so effects are kept light: no heavy blur stacks, no giant animation libraries.
        </p>
        <h3 className="font-display mt-4 text-sm neon-text">WHAT NEEDS INTERNET?</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>AI chat, image generation, homework solver, quiz generation, translation, PDF chat, YouTube summarizer, OCR — these run through protected server functions.</li>
          <li>News, weather, crypto, dictionary, facts &amp; jokes, currency and web search — live public data.</li>
          <li>Python runner — downloads its runtime once, then it's cached.</li>
        </ul>
        <h3 className="font-display mt-4 text-sm neon-text">WHAT WORKS OFFLINE?</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Notes and reminders (saved on your device, synced when you're back).</li>
          <li>Focus Timer, QR generator, Music generator, and all four games (scores sync when you submit them online).</li>
          <li>“Aaj Ka Fact” and the exam countdown — built into the app.</li>
        </ul>
        <h3 className="font-display mt-4 text-sm neon-text">PRIVACY &amp; SAFETY</h3>
        <p className="mt-2">
          Passwords are hashed on the server, roles and scores are validated on the server, and no API key ever
          ships inside the app. Platform safety protections are always on — no setting in this app can turn them off.
        </p>
      </section>
      <section className="panel px-4 py-4 text-center" aria-label="Creator credit">
        <p className="font-display neon-text text-base tracking-widest">CREATED BY LAKSHYA PANDEY</p>
        <p className="mt-1 text-sm text-[var(--dim)]">
          {BRAND.name} is designed, built and maintained by {BRAND.creator} — one person, made with care for
          students and curious minds.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Feedback
export function FeedbackPage({ token, user }: PageProps) {
  const [name, setName] = useState(user.displayName);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const send = useMutation({
    mutationFn: () => api.submitFeedback({ token, name: name.trim(), message: message.trim() }),
    onSuccess: () => setSent(true),
    onError: (e) => setError(e instanceof Error ? e.message : "Could not send feedback."),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Feedback</h2>
      {sent ? (
        <p className="panel px-4 py-4 text-sm" style={{ color: "var(--good)" }}>
          Thank you — your feedback reached the admin team.
        </p>
      ) : (
        <form
          className="panel space-y-3 px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            send.mutate();
          }}
        >
          <label className="block text-sm">
            Your name
            <input aria-label="Your name" className="input-dark" value={name} onChange={(e) => setName(e.target.value)} {...FIELDS.submitFeedback.name} />
          </label>
          <label className="block text-sm">
            Message
            <textarea aria-label="Feedback message" className="input-dark" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} {...FIELDS.submitFeedback.message} placeholder="Ideas, bugs, feature requests — all welcome." />
          </label>
          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
          )}
          <button type="submit" className="btn-primary" disabled={send.isPending || message.trim().length < 3}>
            Send feedback
          </button>
          <p className="text-xs text-[var(--dim)]">Want to rate the app publicly instead? Reviews live on your Profile page — one per account.</p>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Install & Setup
const ANDROID_WORKFLOW = `name: Build Android APK
on:
  workflow_dispatch:
  push:
    branches: [ main ]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - run: npm install
      - run: npm run build
      - name: Add the Android platform (first run only)
        run: if [ ! -d android ]; then npx cap add android; fi
      - run: npx cap sync android
      - name: Build debug APK
        working-directory: android
        run: ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: Yukti-AI-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk`;

const DESKTOP_WORKFLOW = `name: Build Desktop (Electron)
on:
  workflow_dispatch:
jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, ubuntu-latest]
    runs-on: \${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build:desktop   # electron-builder
      - uses: actions/upload-artifact@v4
        with:
          name: qwara-desktop-\${{ matrix.os }}
          path: dist-desktop/**`;

export function InstallPage() {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Install &amp; Setup Guide</h2>

      <section className="panel px-4 py-4 text-sm leading-relaxed">
        <h3 className="font-display text-sm neon-text">ON THIS DEVICE</h3>
        <p className="mt-2">
          You're already using the web app — it runs in the browser with nothing to install. On phones, use your
          browser's “Add to Home screen” to pin {BRAND.short} like an app. Notes, reminders, the Focus Timer, QR and
          music tools keep working offline; AI and live-data tools need internet (see About for the full list).
        </p>
      </section>

      <section className="panel px-4 py-4 text-sm leading-relaxed">
        <h3 className="font-display text-sm neon-text">OPTIONAL KEYS — EVERYTHING WORKS WITHOUT THEM</h3>
        <p className="mt-2">
          Nothing in this app is blocked or broken without a key: accounts, chat, quiz, games, leaderboard, notes,
          and every tool below already work on free keyless services. These optional keys only unlock upgrades in a
          self-hosted deployment — each is free to get, and each belongs only in server secrets (never in browser
          code, the app bundle, logs, or Git):
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <code>GROQ_API_KEY</code> — routes AI chat through Groq in a self-hosted build. Free key: sign up at{" "}
            <strong>console.groq.com</strong> → API Keys. (In this hosted build, AI already runs through the
            platform's protected server channel, so chat works with no key at all.)
          </li>
          <li>
            <code>IMAGE_API_KEY</code> — a paid image provider for self-hosted builds. Not needed here: image
            generation works built-in, with the free keyless <strong>Pollinations</strong> endpoint as backup.
          </li>
          <li>
            <code>RESEND_API_KEY</code> / <code>SMTP_URL</code> — sends email-verification codes by real email.
            Free tier: <strong>resend.com</strong>. Until configured, sign-up shows the code in-app and labels it
            demo delivery.
          </li>
          <li>
            <code>NEWSAPI_API_KEY</code> / <code>GNEWS_API_KEY</code> — richer news sources for self-hosted builds.
            Free keys: <strong>newsapi.org</strong> and <strong>gnews.io</strong>. Not needed here: headlines come
            from BBC's free public RSS feeds.
          </li>
          <li>
            <code>CRICAPI_API_KEY</code> — live cricket data for self-hosted builds. Free key:{" "}
            <strong>cricapi.com</strong>. Not needed here: the Cricket page tries a keyless public feed from your
            browser and otherwise shows a clearly labelled sample scorecard plus live sports headlines.
          </li>
          <li>
            No key exists or is needed for: dictionary (dictionaryapi.dev), weather (Open-Meteo), crypto (CoinGecko
            free tier), currency (ExchangeRate open API), Wikipedia, jokes/facts, translation (MyMemory free tier),
            QR codes, and the URL shortener — all keyless by design.
          </li>
        </ul>
        <p className="mt-2 text-[var(--dim)]">
          The first account to sign up becomes the admin (bootstrap rule) — sign up with the owner's account first.
          Admins can promote other accounts from the Admin page.
        </p>
      </section>

      <section className="panel px-4 py-4 text-sm leading-relaxed">
        <h3 className="font-display text-sm neon-text">TURN ON FIREBASE LOGIN (FREE, ~5 MINUTES)</h3>
        <p className="mt-2">
          Firebase Authentication is the primary sign-in system. Until you complete these steps, the app runs on
          clearly labelled local demo accounts so everything can be tested. To switch:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Go to <strong>console.firebase.google.com</strong> and create a free project (the Spark plan is enough — no card needed).</li>
          <li>In the project, open <strong>Build → Authentication → Sign-in method</strong> and enable <strong>Email/Password</strong>, <strong>Google</strong> and <strong>Phone</strong> — all three are free on the Spark plan (phone OTPs have a small free daily limit). The sign-in page's "Continue with Google" and mobile-number options switch on automatically once the config below is saved.</li>
          <li>Still in Authentication → <strong>Settings → Authorized domains</strong>, make sure this app's domain is listed, or Google sign-in will refuse to open.</li>
          <li><strong>Sender name on verification emails:</strong> in <strong>Project settings → General</strong>, set the project's <strong>public-facing name</strong> to <strong>Lakshya Pandey</strong>, and under <strong>Authentication → Templates</strong> you can also customize the verification email itself. That public name is what users see as the sender of Firebase's verification emails — the app itself can't set it from code.</li>
          <li>Open <strong>Project settings → General → Your apps</strong>, register a <strong>Web app</strong>, and copy the <code>firebaseConfig</code> object it shows.</li>
          <li>In this app, sign in as admin, open <strong>Admin Control → Firebase Authentication</strong>, paste the config JSON into the <code>FIREBASE_CONFIG</code> setting, add your email to the admin allowlist, and save. (The owner's main email, typeforyou11@gmail.com, is already on the allowlist and is promoted to admin automatically.)</li>
          <li>Sign out — the sign-in page now uses Firebase: email sign-up with Firebase's own verification email (new accounts must verify before they can use the app), one-tap Google sign-in, and mobile-number OTP sign-in.</li>
        </ol>
        <p className="mt-2 text-[var(--dim)]">
          How it fits together: Firebase handles passwords and verification emails. The app server verifies each
          Firebase ID token itself, then ties reviews, scores, notes and settings to that Firebase user in the
          app's own database — so <strong>Firestore and Cloud Functions are not needed</strong>, and everything
          stays on Firebase's free Spark plan. Admin access comes only from the server-side email allowlist —
          never from anything stored in the browser. Existing local accounts with the same email are linked to
          the Firebase account automatically on first Firebase sign-in.
        </p>
      </section>

      <section className="panel px-4 py-4 text-sm leading-relaxed">
        <h3 className="font-display text-sm neon-text">LOCAL DEVELOPMENT</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Clone the project repository.</li>
          <li>Run <code>bun install</code> (or <code>npm install</code>).</li>
          <li>Copy <code>.env.example</code> to <code>.env</code> and fill in the secrets above — never commit <code>.env</code>.</li>
          <li>Run <code>bun run dev</code> and open the local URL.</li>
        </ol>
      </section>

      <section className="panel px-4 py-4 text-sm leading-relaxed">
        <h3 className="font-display text-sm neon-text">ANDROID APK (CAPACITOR + GITHUB ACTIONS)</h3>
        <p className="mt-2">
          Capacitor is already set up in this project (<code>capacitor.config.ts</code>, app name{" "}
          <strong>Yukti AI</strong>, package <code>com.lakshyapandey.yukti</code>). Because accounts, chat and
          the AI tools run on this app's server, the APK is a native shell that opens the live app
          (Capacitor's <code>server.url</code>) — every feature works exactly like the web version, and the
          phone just needs internet, same as the website.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Push this project to GitHub (branch <code>main</code>) — the workflow below starts by itself. Or open the repo's <strong>Actions</strong> tab → <strong>Build Android APK</strong> → <strong>Run workflow</strong>.</li>
          <li>Wait for the run to finish, open it, and download the <code>Yukti-AI-APK</code> artifact (a zip with <code>app-debug.apk</code> inside).</li>
          <li>Send the APK to the phone, tap it, allow “Install unknown apps” when Android asks, and tap Install.</li>
          <li>No API keys go in the repo or the APK — the app talks to the hosted server, which holds the secrets. Full instructions are in <code>APK.md</code> in the project.</li>
        </ol>
        <pre className="codeblock mt-3">{ANDROID_WORKFLOW}</pre>
      </section>

      <section className="panel px-4 py-4 text-sm leading-relaxed">
        <h3 className="font-display text-sm neon-text">DESKTOP (ELECTRON, WINDOWS + LINUX)</h3>
        <p className="mt-2">
          The desktop build wraps the same web app with Electron and enables the Desktop Controls companion
          (bounded app-opening and volume commands with confirmation for shutdown/restart). Build it with
          electron-builder via the workflow below (<code>.github/workflows/desktop.yml</code>).
        </p>
        <p className="mt-2 text-[var(--dim)]">
          Windows 7 note: the companion targets Windows 7-era hardware for performance, but voice input, speech
          output and the wake phrase need a modern browser engine and are labelled unavailable on Windows 7.
          Modern Electron versions themselves require Windows 10+, so a Windows 7 install uses the legacy
          companion shell — everything except voice features works there.
        </p>
        <pre className="codeblock mt-3">{DESKTOP_WORKFLOW}</pre>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Admin
export function AdminPage({ token }: PageProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const data = useQuery({
    queryKey: ["admin-data"],
    queryFn: () => api.getAdminData({ token }),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin-data"] });

  const saveSettings = useMutation({
    mutationFn: (settings: Record<string, string>) => api.adminSaveSettings({ token, settings }),
    onSuccess: () => {
      setMsg("Settings saved.");
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save settings."),
  });
  const addAnn = useMutation({
    mutationFn: () => api.adminAddAnnouncement({ token, title: annTitle.trim(), body: annBody.trim() }),
    onSuccess: () => {
      setAnnTitle("");
      setAnnBody("");
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not publish."),
  });
  const delAnn = useMutation({
    mutationFn: (id: number) => api.adminDeleteAnnouncement({ token, id }),
    onSuccess: refresh,
  });
  const hideReview = useMutation({
    mutationFn: (args: { id: number; hidden: boolean }) => api.adminSetReviewHidden({ token, ...args }),
    onSuccess: refresh,
  });
  const fbStatus = useMutation({
    mutationFn: (args: { id: number; status: "open" | "resolved" }) => api.adminSetFeedbackStatus({ token, ...args }),
    onSuccess: refresh,
  });
  const setRole = useMutation({
    mutationFn: (args: { userId: number; role: "user" | "admin" }) => api.adminSetUserRole({ token, ...args }),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not change the role."),
  });

  if (data.isPending) return <p className="text-sm text-[var(--dim)]">Loading admin data…</p>;
  if (data.error) {
    return (
      <p role="alert" className="panel px-4 py-3 text-sm" style={{ color: "var(--danger)" }}>
        {data.error instanceof Error ? data.error.message : "Admin data unavailable."}
      </p>
    );
  }
  const s = data.data!.settings;
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Admin Control</h2>
      {msg && <p className="panel px-4 py-2 text-sm" style={{ color: "var(--good)" }}>{msg}</p>}
      {error && (
        <p role="alert" className="panel px-4 py-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>
      )}

      <section className="panel space-y-3 px-4 py-4" aria-label="Site settings">
        <h3 className="font-display text-sm neon-text">SITE &amp; ASSISTANT DEFAULTS</h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setError("");
            saveSettings.mutate({
              maintenance: form.get("maintenance") === "on" ? "1" : "0",
              maintenance_message: String(form.get("maintenance_message") ?? ""),
              default_voice: String(form.get("default_voice") ?? ""),
              default_language: String(form.get("default_language") ?? "en-IN"),
              default_style: String(form.get("default_style") ?? "normal"),
              wake_phrase: String(form.get("wake_phrase") ?? BRAND.defaultWakePhrase),
              firebase_config: String(form.get("firebase_config") ?? ""),
              admin_emails: String(form.get("admin_emails") ?? ""),
            });
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="maintenance" defaultChecked={s.maintenance === "1"} />
            Maintenance mode (non-admin visitors see the maintenance message)
          </label>
          <label className="block text-sm">
            Maintenance message
            <input aria-label="Maintenance message" name="maintenance_message" className="input-dark" defaultValue={s.maintenance_message ?? ""} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Default voice name
              <input aria-label="Default voice name" name="default_voice" className="input-dark" defaultValue={s.default_voice ?? ""} placeholder="Leave blank for system default" />
            </label>
            <label className="text-sm">
              Default language
              <select aria-label="Default language" name="default_language" className="input-dark" defaultValue={s.default_language ?? "en-IN"}>
                {ASSISTANT_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Default response style
              <select aria-label="Default response style" name="default_style" className="input-dark" defaultValue={s.default_style ?? "normal"}>
                <option value="normal">Normal</option>
                <option value="detailed">Detailed</option>
                <option value="short">Short</option>
                <option value="developer">Developer</option>
              </select>
            </label>
            <label className="text-sm">
              Wake phrase
              <input aria-label="Wake phrase" name="wake_phrase" className="input-dark" defaultValue={s.wake_phrase ?? BRAND.defaultWakePhrase} />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={saveSettings.isPending}>
            Save settings
          </button>
          <p className="text-xs text-[var(--dim)]">
            Safety note: platform safety protections are always enabled and cannot be disabled from this panel — these settings only change defaults like voice, language and style.
          </p>
        </form>
      </section>

      <section className="panel space-y-3 px-4 py-4" aria-label="Firebase authentication settings">
        <h3 className="font-display text-sm neon-text">FIREBASE AUTHENTICATION</h3>
        <p className="text-sm text-[var(--dim)]">
          Paste the Firebase web config JSON from your Firebase project (see Install &amp; Setup for the free
          step-by-step). It is stored as a server-side setting — never hardcoded in the app. While this is empty,
          the app uses local demo accounts. The admin allowlist is enforced on the server: only these emails get
          the admin role, whichever sign-in method they use (email, Google, or a linked account).
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setError("");
            saveSettings.mutate({
              firebase_config: String(form.get("firebase_config") ?? ""),
              admin_emails: String(form.get("admin_emails") ?? ""),
            });
          }}
        >
          <label className="block text-sm">
            Firebase web config (JSON)
            <textarea
              aria-label="Firebase web config JSON"
              name="firebase_config"
              className="input-dark"
              rows={5}
              defaultValue={s.firebase_config ?? ""}
              placeholder='{"apiKey":"…","authDomain":"…","projectId":"…","appId":"…"}'
              spellCheck={false}
              style={{ fontFamily: "monospace" }}
            />
          </label>
          <label className="block text-sm">
            Admin email allowlist (comma-separated)
            <input
              aria-label="Admin email allowlist"
              name="admin_emails"
              className="input-dark"
              defaultValue={s.admin_emails ?? ""}
              placeholder="owner@example.com, second-admin@example.com"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={saveSettings.isPending}>
            Save Firebase settings
          </button>
          <p className="text-xs text-[var(--dim)]">
            Current status: {s.firebase_config ? "a config is saved — Firebase sign-in is offered when it contains apiKey, authDomain, projectId and appId." : "no config saved — local demo auth is active."}
          </p>
        </form>
      </section>

      <section className="panel space-y-3 px-4 py-4" aria-label="Announcements">
        <h3 className="font-display text-sm neon-text">ANNOUNCEMENTS</h3>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            addAnn.mutate();
          }}
        >
          <label className="block text-sm">
            Title
            <input aria-label="Announcement title" className="input-dark" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} {...FIELDS.adminAddAnnouncement.title} />
          </label>
          <label className="block text-sm">
            Message
            <textarea aria-label="Announcement message" className="input-dark" rows={2} value={annBody} onChange={(e) => setAnnBody(e.target.value)} {...FIELDS.adminAddAnnouncement.body} />
          </label>
          <button type="submit" className="btn-primary" disabled={addAnn.isPending || annTitle.trim().length < 2 || annBody.trim().length < 2}>
            Publish announcement
          </button>
        </form>
        <ul className="space-y-2 text-sm">
          {data.data!.announcements.map((a) => (
            <li key={a.id} className="panel-raised flex items-start justify-between gap-2 px-3 py-2">
              <span>
                <strong>{a.title}</strong> — {a.body}
              </span>
              <button type="button" className="btn-ghost" onClick={() => delAnn.mutate(a.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel px-4 py-4" aria-label="Moderate reviews">
        <h3 className="font-display text-sm neon-text">MODERATE REVIEWS</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {data.data!.reviews.length === 0 && <li className="text-[var(--dim)]">No reviews yet.</li>}
          {data.data!.reviews.map((r) => (
            <li key={r.id} className="panel-raised flex items-start justify-between gap-2 px-3 py-2">
              <span>
                {"★".repeat(r.stars)} {r.displayName}: “{r.text}” {r.hidden ? "(hidden)" : ""}
              </span>
              <button type="button" className="btn-ghost" onClick={() => hideReview.mutate({ id: r.id, hidden: !r.hidden })}>
                {r.hidden ? "Unhide" : "Hide"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel px-4 py-4" aria-label="Feedback inbox">
        <h3 className="font-display text-sm neon-text">FEEDBACK INBOX</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {data.data!.feedback.length === 0 && <li className="text-[var(--dim)]">No feedback yet.</li>}
          {data.data!.feedback.map((f) => (
            <li key={f.id} className="panel-raised flex items-start justify-between gap-2 px-3 py-2">
              <span>
                <strong>{f.name}</strong> ({f.status}): {f.message}
              </span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => fbStatus.mutate({ id: f.id, status: f.status === "open" ? "resolved" : "open" })}
              >
                {f.status === "open" ? "Mark resolved" : "Reopen"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel px-4 py-4" aria-label="Users">
        <h3 className="font-display text-sm neon-text">USERS &amp; ROLES</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {data.data!.users.map((u) => (
            <li key={u.id} className="panel-raised flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                {u.displayName} · {u.email} · <strong>{u.role}</strong>
                {u.emailVerified ? " · verified" : " · unverified"}
              </span>
              {u.role === "admin" ? (
                <button type="button" className="btn-ghost" onClick={() => setRole.mutate({ userId: u.id, role: "user" })}>
                  Make user
                </button>
              ) : (
                <button type="button" className="btn-ghost" onClick={() => setRole.mutate({ userId: u.id, role: "admin" })}>
                  Make admin
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--dim)]">
          Roles are stored and enforced on the server — changing anything in the browser cannot grant admin access.
        </p>
      </section>
    </div>
  );
}
