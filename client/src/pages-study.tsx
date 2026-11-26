// Study tools: AI Quiz (incl. Notes-to-Quiz), Focus Timer, Homework Solver,
// YouTube Summarizer, Image-to-Text.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { api } from "./api";
import type { PageProps } from "./appctx";
import { setChatPrefill } from "./appctx";
import {
BRAND,
fileToBase64Payload,
localDayString,
localNotes,
useInterval,
} from "./lib";

const FIELDS = actionFields<typeof Actions>();

const LEVELS = [
  "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
  "Class 11", "Class 12", "College", "Competitive exams",
];
const SUBJECTS = [
  "General Knowledge", "Mathematics", "Science", "English", "Hindi",
  "Social Science", "Computer Science", "Current Affairs",
];

// ---------------------------------------------------------------- Quiz
type QuizQuestion = { question: string; options: string[] };
type QuizFeedback = {
  question: string;
  options: string[];
  yourAnswer: number;
  correctIndex: number;
  correct: boolean;
};

export function QuizPage({ token }: PageProps) {
  const [level, setLevel] = useState("Class 10");
  const [subject, setSubject] = useState("General Knowledge");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [sourceMode, setSourceMode] = useState<"topic" | "notes">("topic");
  const [notesText, setNotesText] = useState("");
  const [quizId, setQuizId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    points: number;
    currentStreak: number;
    feedback: QuizFeedback[];
  } | null>(null);
  const [error, setError] = useState("");
  const savedNotes = useMemo(() => localNotes.all().filter((n) => !n.deleted), []);

  const start = useMutation({
    mutationFn: () =>
      api.startQuiz({
        token,
        level,
        subject,
        difficulty,
        sourceText: sourceMode === "notes" ? notesText : "",
      }),
    onSuccess: (d) => {
      setQuizId(d.quizId);
      setQuestions(d.questions);
      setAnswers(new Array(d.questions.length).fill(-1));
      setResult(null);
      setError("");
    },
    onError: (e) =>
      setError(
        e instanceof Error
          ? e.message
          : "Quiz generation is unavailable right now. Please try again.",
      ),
  });

  const submit = useMutation({
    mutationFn: () => api.submitQuiz({ token, quizId: quizId ?? 0, answers, day: localDayString() }),
    onSuccess: (d) => setResult(d),
    onError: (e) => setError(e instanceof Error ? e.message : "Could not score the quiz."),
  });

  if (result) {
    return (
      <div className="space-y-4">
        <section className="panel px-4 py-5 text-center">
          <h2 className="font-display text-xl">Quiz complete</h2>
          <p className="mt-2 text-lg">
            You scored <strong className="neon-text">{result.correct}/{result.total}</strong>
          </p>
          <p className="text-sm text-[var(--dim)]">
            {result.points > 0
              ? `+${result.points} points added to the leaderboard (scored and validated on the server).`
              : "No points this time — every correct answer earns 10 points. Try again!"}
          </p>
          {result.currentStreak > 0 && (
            <p className="mt-2 text-sm">
              Study streak: <strong className="neon-text">{result.currentStreak} day{result.currentStreak === 1 ? "" : "s"}</strong>
              {" "}— study again tomorrow to keep it growing. Badges unlock at 3, 7 and 30 days.
            </p>
          )}
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => {
              setQuizId(null);
              setQuestions([]);
              setResult(null);
            }}
          >
            New quiz
          </button>
        </section>
        <section className="space-y-3" aria-label="Answer feedback">
          {result.feedback.map((f, i) => (
            <div key={i} className="panel px-4 py-3">
              <p className="font-medium">
                {i + 1}. {f.question}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {f.options.map((opt, oi) => (
                  <li
                    key={oi}
                    className="px-2 py-1"
                    style={{
                      borderRadius: 8,
                      background:
                        oi === f.correctIndex
                          ? "rgba(52,211,153,0.15)"
                          : oi === f.yourAnswer
                            ? "rgba(251,113,133,0.15)"
                            : "transparent",
                    }}
                  >
                    {opt}
                    {oi === f.correctIndex ? " ✓ correct" : ""}
                    {oi === f.yourAnswer && oi !== f.correctIndex ? " — your answer" : ""}
                  </li>
                ))}
              </ul>
              {f.yourAnswer === -1 && <p className="mt-1 text-sm text-[var(--dim)]">You skipped this one.</p>}
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (quizId !== null && questions.length > 0) {
    const answered = answers.filter((a) => a >= 0).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">
            {subject} · {level} · {difficulty}
          </h2>
          <span className="text-sm text-[var(--dim)]">
            {answered}/{questions.length} answered
          </span>
        </div>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        {questions.map((q, qi) => (
          <fieldset key={qi} className="panel px-4 py-3">
            <legend className="px-1 font-medium">
              {qi + 1}. {q.question}
            </legend>
            <div className="mt-2 space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className="panel-raised flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name={`q-${qi}`}
                    checked={answers[qi] === oi}
                    onChange={() =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[qi] = oi;
                        return next;
                      })
                    }
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? "Scoring on the server…" : "Submit & see my score"}
        </button>
        <p className="text-xs text-[var(--dim)]">
          Answers are scored on the server against the stored answer key — scores can't be edited from the browser.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">AI Quiz</h2>
      <div className="panel space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quiz source">
          <button
            type="button"
            className={sourceMode === "topic" ? "btn-primary" : "btn-ghost"}
            onClick={() => setSourceMode("topic")}
          >
            By class & subject
          </button>
          <button
            type="button"
            className={sourceMode === "notes" ? "btn-primary" : "btn-ghost"}
            onClick={() => setSourceMode("notes")}
          >
            From my notes (Notes-to-Quiz)
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Class / level
            <select aria-label="Class or level" className="input-dark" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Subject
            <select aria-label="Subject" className="input-dark" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Difficulty
            <select aria-label="Difficulty" className="input-dark" value={difficulty} onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>
        {sourceMode === "notes" && (
          <div className="space-y-2">
            {savedNotes.length > 0 && (
              <label className="block text-sm">
                Pick a saved note
                <select
                  aria-label="Pick a saved note"
                  className="input-dark"
                  defaultValue=""
                  onChange={(e) => {
                    const n = savedNotes.find((x) => x.clientId === e.target.value);
                    if (n) setNotesText(`${n.title}\n\n${n.body}`);
                  }}
                >
                  <option value="">Choose a note…</option>
                  {savedNotes.map((n) => (
                    <option key={n.clientId} value={n.clientId}>
                      {n.title || "Untitled note"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm">
              Or paste your notes here
              <textarea
                aria-label="Paste your notes"
                className="input-dark"
                rows={7}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Paste at least a few lines of study notes — the quiz is generated only from this text."
                {...FIELDS.startQuiz.sourceText}
              />
            </label>
            <p className="text-xs text-[var(--dim)]">
              Notes-to-Quiz needs an internet connection for generation. If generation is unavailable you'll see a clear error here — never a fake quiz.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={start.isPending || (sourceMode === "notes" && notesText.trim().length < 40)}
          onClick={() => start.mutate()}
        >
          {start.isPending ? "Generating questions…" : "Start quiz (8 questions · 10 pts each)"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Focus Timer
const FOCUS_LOG_KEY = "qwara-focus-log";

function focusLog(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FOCUS_LOG_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FocusTimerPage() {
  const [focusLen, setFocusLen] = useState(25);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [todayMinutes, setTodayMinutes] = useState(() => focusLog()[todayKey()] ?? 0);
  const [sessionsToday, setSessionsToday] = useState(() => {
    try {
      return Number(localStorage.getItem("qwara-focus-sessions") ?? 0);
    } catch {
      return 0;
    }
  });
  const countedRef = useRef(false);

  useInterval(
    () => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    },
    running ? 1000 : null,
  );

  useEffect(() => {
    if (remaining === 0 && mode === "focus" && !countedRef.current) {
      countedRef.current = true;
      const log = focusLog();
      log[todayKey()] = (log[todayKey()] ?? 0) + focusLen;
      try {
        localStorage.setItem(FOCUS_LOG_KEY, JSON.stringify(log));
        const s = sessionsToday + 1;
        localStorage.setItem("qwara-focus-sessions", String(s));
        setSessionsToday(s);
      } catch {
        /* ignore */
      }
      setTodayMinutes(log[todayKey()] ?? 0);
    }
    if (remaining > 0) countedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, mode]);

  function startSession(nextMode: "focus" | "break", minutes: number) {
    setMode(nextMode);
    setRemaining(minutes * 60);
    setRunning(true);
    countedRef.current = false;
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Focus Timer</h2>
      <section className="panel px-4 py-6 text-center">
        <p className="text-sm tracking-widest text-[var(--dim)]">
          {mode === "focus" ? "FOCUS SESSION" : "BREAK"} · works fully offline
        </p>
        <p className="font-display neon-text my-4 text-5xl" aria-live="polite">
          {mm}:{ss}
        </p>
        {remaining === 0 && (
          <p className="mb-3 text-sm" style={{ color: "var(--good)" }}>
            {mode === "focus"
              ? "Session complete — added to today's focus total. Take a break!"
              : "Break over — ready for the next session?"}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {!running ? (
            <button type="button" className="btn-primary" onClick={() => setRunning(true)}>
              {remaining > 0 && remaining < (mode === "focus" ? focusLen : 5) * 60 ? "Resume" : "Start"}
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setRunning(false)}>
              Pause
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => startSession("focus", focusLen)}
          >
            Restart focus
          </button>
          <button type="button" className="btn-ghost" onClick={() => startSession("break", 5)}>
            5-min break
          </button>
          <button type="button" className="btn-ghost" onClick={() => startSession("break", 15)}>
            15-min break
          </button>
        </div>
        <label className="mt-4 block text-sm">
          Focus length{" "}
          <select
            aria-label="Focus session length"
            className="input-dark"
            style={{ width: "auto", display: "inline-block" }}
            value={focusLen}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFocusLen(v);
              if (mode === "focus" && !running) setRemaining(v * 60);
            }}
          >
            <option value={15}>15 minutes</option>
            <option value={25}>25 minutes</option>
            <option value={50}>50 minutes</option>
          </select>
        </label>
      </section>
      <section className="panel grid grid-cols-2 gap-3 px-4 py-4 text-center">
        <div>
          <p className="font-display text-2xl neon-text">{todayMinutes} min</p>
          <p className="text-sm text-[var(--dim)]">Focused today</p>
        </div>
        <div>
          <p className="font-display text-2xl neon-text">{sessionsToday}</p>
          <p className="text-sm text-[var(--dim)]">Sessions completed</p>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Homework Solver
export function HomeworkPage({ token }: PageProps) {
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState("Class 10");
  const [image, setImage] = useState<{ dataBase64: string; mimeType: string } | null>(null);
  const [imageName, setImageName] = useState("");
  const [error, setError] = useState("");

  const solve = useMutation({
    mutationFn: () =>
      api.solveHomework({
        token,
        question: question.trim(),
        level,
        image: image ?? undefined,
      }),
    onError: (e) =>
      setError(
        e instanceof Error
          ? e.message
          : "The solver is unavailable right now. Check your connection and try again.",
      ),
  });

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Homework Solver</h2>
      <p className="text-sm text-[var(--dim)]">
        Type a question or upload a photo of it — {BRAND.short} explains the answer step by step, like a teacher.
      </p>
      <form
        className="panel space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          solve.mutate();
        }}
      >
        <label className="block text-sm">
          Your class
          <select aria-label="Your class" className="input-dark" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Question
          <textarea
            aria-label="Homework question"
            className="input-dark"
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Solve: 2x + 6 = 14. Or: Why does the Moon change shape?"
            {...FIELDS.solveHomework.question}
          />
        </label>
        <label className="block text-sm">
          Or a photo of the question (JPG/PNG)
          <input
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            aria-label="Upload a photo of the question"
            className="input-dark"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setImage(await fileToBase64Payload(f));
                setImageName(f.name);
                setError("");
              } catch {
                setError("Could not read that image. Try another photo.");
              }
            }}
          />
        </label>
        {imageName && (
          <p className="text-sm text-[var(--dim)]">
            Photo attached: {imageName}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setImage(null);
                setImageName("");
              }}
            >
              Remove
            </button>
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={solve.isPending || (!question.trim() && !image)}>
          {solve.isPending ? "Working it out…" : "Solve step by step"}
        </button>
      </form>
      {solve.data && (
        <section className="panel px-4 py-4" aria-label="Solution">
          <h3 className="font-display text-sm neon-text">ANSWER</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{solve.data.answer}</p>
          {solve.data.steps.length > 0 && (
            <>
              <h3 className="font-display mt-4 text-sm neon-text">STEP BY STEP</h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                {solve.data.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </>
          )}
          <p className="mt-3 text-xs text-[var(--dim)]">
            Tip: read the steps, close the app, and try the same question yourself — that's where the learning happens.
          </p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- YouTube Summarizer
export function YouTubePage({ token }: PageProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const summarize = useMutation({
    mutationFn: () => api.summarizeYouTube({ token, url: url.trim() }),
    onError: (e) => setError(e instanceof Error ? e.message : "Could not summarize that video."),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">YouTube Summarizer</h2>
      <form
        className="panel space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          summarize.mutate();
        }}
      >
        <label className="block text-sm">
          YouTube video link
          <input
            aria-label="YouTube video link"
            className="input-dark"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            {...FIELDS.summarizeYouTube.url}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={summarize.isPending || url.trim().length < 8}>
          {summarize.isPending ? "Summarizing…" : "Summarize video"}
        </button>
        <p className="text-xs text-[var(--dim)]">
          Uses the video's public title and description. When a full transcript isn't publicly retrievable, the result says so clearly.
        </p>
      </form>
      {summarize.data && (
        <section className="panel px-4 py-4" aria-label="Video summary">
          <h3 className="font-display">{summarize.data.title}</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--warn)" }}>{summarize.data.basis}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{summarize.data.summary}</p>
          {summarize.data.keyPoints.length > 0 && (
            <>
              <h4 className="font-display mt-4 text-sm neon-text">KEY POINTS</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {summarize.data.keyPoints.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Image-to-Text (OCR)
export function OcrPage({ token, go }: PageProps) {
  const [image, setImage] = useState<{ dataBase64: string; mimeType: string } | null>(null);
  const [imageName, setImageName] = useState("");
  const [error, setError] = useState("");
  const extract = useMutation({
    mutationFn: () => api.extractImageText({ token, image: image! }),
    onError: (e) =>
      setError(
        e instanceof Error
          ? e.message
          : "Text extraction isn't available right now. Try a clearer photo.",
      ),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Image to Text</h2>
      <p className="text-sm text-[var(--dim)]">
        Upload a photo of a page, board or sign and {BRAND.short} pulls the text out of it.
      </p>
      <div className="panel space-y-3 px-4 py-4">
        <label className="block text-sm">
          Image (JPG/PNG)
          <input
            type="file"
            accept="image/jpeg,image/png"
            aria-label="Upload an image to extract text from"
            className="input-dark"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setImage(await fileToBase64Payload(f));
                setImageName(f.name);
                setError("");
              } catch {
                setError("Could not read that image file.");
              }
            }}
          />
        </label>
        {imageName && <p className="text-sm text-[var(--dim)]">Selected: {imageName}</p>}
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!image || extract.isPending}
          onClick={() => {
            setError("");
            extract.mutate();
          }}
        >
          {extract.isPending ? "Reading the image…" : "Extract text"}
        </button>
      </div>
      {extract.data && (
        <section className="panel px-4 py-4" aria-label="Extracted text">
          <h3 className="font-display text-sm neon-text">EXTRACTED TEXT</h3>
          <pre className="codeblock mt-2">{extract.data.text}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(extract.data!.text);
              }}
            >
              Copy text
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setChatPrefill(`Explain this text in simple words:\n\n${extract.data!.text.slice(0, 1500)}`);
                go("chat");
              }}
            >
              Explain this text in chat
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
