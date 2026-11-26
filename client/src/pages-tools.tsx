// AI tool pages: Image Studio, PDF Chat, Code Generator, Python Runner,
// Translator, Music Generator, Prompt Library, Desktop Controls.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { api } from "./api";
import type { PageProps } from "./appctx";
import { setChatPrefill } from "./appctx";
import { fileToBase64Payload } from "./lib";

const FIELDS = actionFields<typeof Actions>();

// ---------------------------------------------------------------- Image Studio
export function ImagePage({ token }: PageProps) {
  const [prompt, setPrompt] = useState("");
  const [orientation, setOrientation] = useState<"square" | "landscape" | "portrait">("square");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Array<{ prompt: string; url: string }>>([]);
  const gen = useMutation({
    mutationFn: () => api.generateImage({ token, prompt: prompt.trim(), orientation }),
    onSuccess: (d) => {
      setHistory((prev) => [{ prompt: prompt.trim(), url: d.url }, ...prev].slice(0, 12));
      setError("");
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Image generation failed. Please try again."),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Image Studio</h2>
      <form
        className="panel space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          gen.mutate();
        }}
      >
        <label className="block text-sm">
          Describe the image
          <textarea
            aria-label="Image prompt"
            className="input-dark"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A futuristic robot drinking chai in a Mumbai local train, digital art"
            {...FIELDS.generateImage.prompt}
          />
        </label>
        <label className="block text-sm">
          Shape
          <select
            aria-label="Image shape"
            className="input-dark"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as typeof orientation)}
          >
            <option value="square">Square</option>
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={gen.isPending || prompt.trim().length < 3}>
          {gen.isPending ? "Generating… (this can take a few seconds)" : "Generate image"}
        </button>
        <p className="text-xs text-[var(--dim)]">
          Generation runs through a protected server function — no image API key ever sits in the app.
        </p>
      </form>
      {history.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Your generated images">
          {history.map((h, i) => (
            <figure key={i} className="panel px-3 py-3">
              <img src={h.url} alt={h.prompt} className="w-full rounded-lg" />
              <figcaption className="mt-2 text-sm text-[var(--dim)]">{h.prompt}</figcaption>
              <a className="btn-ghost mt-2 inline-block" href={h.url} download={`qwara-image-${i + 1}.png`}>
                Download
              </a>
            </figure>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- PDF Chat
export function PdfChatPage({ token }: PageProps) {
  const [fileName, setFileName] = useState("");
  const [dataBase64, setDataBase64] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Array<{ q: string; a: string }>>([]);
  const ask = useMutation({
    mutationFn: () => api.pdfChat({ token, fileName, dataBase64, question: question.trim() }),
    onSuccess: (d) => {
      setAnswers((prev) => [...prev, { q: question.trim(), a: d.answer }]);
      setQuestion("");
      setError("");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not read that PDF."),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Chat with a PDF</h2>
      <div className="panel space-y-3 px-4 py-4">
        <label className="block text-sm">
          PDF file (text-based, up to ~6 MB)
          <input
            type="file"
            accept="application/pdf"
            aria-label="Upload a PDF"
            className="input-dark"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 6_000_000) {
                setError("That PDF is too large (max ~6 MB). Try a smaller file.");
                return;
              }
              try {
                const payload = await fileToBase64Payload(f);
                setDataBase64(payload.dataBase64);
                setFileName(f.name);
                setError("");
              } catch {
                setError("Could not read that file.");
              }
            }}
          />
        </label>
        {fileName && <p className="text-sm text-[var(--dim)]">Loaded: {fileName}</p>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!dataBase64) {
              setError("Upload a PDF first.");
              return;
            }
            ask.mutate();
          }}
        >
          <label className="sr-only" htmlFor="pdf-q">Question about the PDF</label>
          <input
            id="pdf-q"
            className="input-dark grow"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about the document… e.g. Summarize chapter 1"
            {...FIELDS.pdfChat.question}
          />
          <button type="submit" className="btn-primary" disabled={ask.isPending || !question.trim()}>
            {ask.isPending ? "Reading…" : "Ask"}
          </button>
        </form>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <p className="text-xs text-[var(--dim)]">
          Answers come only from the document's own text. Scanned/image-only PDFs have no extractable text — you'll get a clear message instead of a made-up answer.
        </p>
      </div>
      {answers.length > 0 && (
        <section className="space-y-3" aria-label="PDF answers">
          {answers.map((a, i) => (
            <div key={i} className="panel px-4 py-3">
              <p className="text-sm font-semibold">Q: {a.q}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{a.a}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Code Generator
const CODE_LANGS = ["Python", "JavaScript", "TypeScript", "Java", "C", "C++", "HTML/CSS", "SQL", "Go", "Rust"];

export function CodePage({ token, go }: PageProps) {
  const [task, setTask] = useState("");
  const [language, setLanguage] = useState("Python");
  const [error, setError] = useState("");
  const [sentToRunner, setSentToRunner] = useState(false);
  const gen = useMutation({
    mutationFn: () => api.generateCode({ token, task: task.trim(), language }),
    onError: (e) => setError(e instanceof Error ? e.message : "Code generation failed."),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Code Generator</h2>
      <form
        className="panel space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          gen.mutate();
        }}
      >
        <label className="block text-sm">
          Language
          <select aria-label="Programming language" className="input-dark" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {CODE_LANGS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          What should the code do?
          <textarea
            aria-label="Describe the code you need"
            className="input-dark"
            rows={3}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. A function that checks if a number is prime, with examples"
            {...FIELDS.generateCode.task}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={gen.isPending || task.trim().length < 3}>
          {gen.isPending ? "Writing code…" : "Generate code"}
        </button>
      </form>
      {gen.data && (
        <section className="panel px-4 py-4" aria-label="Generated code">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm neon-text">{language.toUpperCase()}</h3>
            <button type="button" className="btn-ghost" onClick={() => void navigator.clipboard?.writeText(gen.data!.code)}>
              Copy code
            </button>
          </div>
          <pre className="codeblock mt-2">{gen.data.code}</pre>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{gen.data.explanation}</p>
          {language === "Python" && (
            <span className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  try {
                    localStorage.setItem("qwara-python-prefill", gen.data!.code);
                  } catch {
                    /* ignore */
                  }
                  setSentToRunner(true);
                }}
              >
                Send to Python Runner
              </button>
              {sentToRunner && (
                <button type="button" className="btn-primary" onClick={() => go("python")}>
                  Open Python Runner
                </button>
              )}
            </span>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Python Runner (Pyodide)
type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideLike>;
  }
}

const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

export function PythonPage() {
  const [code, setCode] = useState(
    () => {
      try {
        const pre = localStorage.getItem("qwara-python-prefill");
        if (pre) {
          localStorage.removeItem("qwara-python-prefill");
          return pre;
        }
      } catch {
        /* ignore */
      }
      return 'name = "Yukti"\nfor i in range(1, 6):\n    print(i, "x", i, "=", i * i)\nprint("Hello from", name)';
    },
  );
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const pyRef = useRef<PyodideLike | null>(null);

  async function ensurePyodide(): Promise<PyodideLike | null> {
    if (pyRef.current) return pyRef.current;
    setStatus("loading");
    try {
      if (!window.loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = `${PYODIDE_BASE}pyodide.js`;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("load failed"));
          document.head.appendChild(s);
        });
      }
      const py = await window.loadPyodide!({ indexURL: PYODIDE_BASE });
      pyRef.current = py;
      setStatus("ready");
      return py;
    } catch {
      setStatus("error");
      return null;
    }
  }

  async function run() {
    const py = await ensurePyodide();
    if (!py) {
      setOutput("Python could not be loaded. The runner downloads the Python runtime (~10 MB) from a CDN, so it needs an internet connection the first time. Check your connection and try again.");
      return;
    }
    const lines: string[] = [];
    py.setStdout({ batched: (s) => lines.push(s) });
    py.setStderr({ batched: (s) => lines.push(s) });
    try {
      await py.runPythonAsync(code);
      setOutput(lines.join("\n") || "(no output — add a print() to see results)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(`${lines.join("\n")}${lines.length ? "\n" : ""}Error: ${msg.split("\n").slice(-4).join("\n")}`);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Python Runner</h2>
      <p className="text-sm text-[var(--dim)]">
        Real Python, running inside your browser (Pyodide). First run downloads the runtime, so it needs internet once; after that it's cached by the browser.
      </p>
      <div className="panel space-y-3 px-4 py-4">
        <label className="block text-sm">
          Python code
          <textarea
            aria-label="Python code"
            className="input-dark"
            rows={10}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            style={{ fontFamily: "monospace" }}
            
          />
        </label>
        <button type="button" className="btn-primary w-full" onClick={() => void run()}>
          {status === "loading" ? "Loading Python…" : "Run code"}
        </button>
        {status === "error" && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
            Couldn't load the Python runtime — check your internet connection and retry.
          </p>
        )}
      </div>
      {output && (
        <section className="panel px-4 py-4" aria-label="Program output">
          <h3 className="font-display text-sm neon-text">OUTPUT</h3>
          <pre className="codeblock mt-2">{output}</pre>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Translator
const LANGS = [
  "Hindi", "English", "Hinglish (Roman Hindi)", "Spanish", "French", "German",
  "Bengali", "Tamil", "Telugu", "Marathi", "Punjabi", "Gujarati", "Japanese",
  "Korean", "Arabic", "Portuguese", "Russian", "Italian",
];

export function TranslatePage({ token }: PageProps) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState("Hindi");
  const [error, setError] = useState("");
  const tr = useMutation({
    mutationFn: () => api.translateText({ token, text: text.trim(), targetLanguage: target }),
    onError: (e) => setError(e instanceof Error ? e.message : "Translation failed."),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Translator</h2>
      <form
        className="panel space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          tr.mutate();
        }}
      >
        <label className="block text-sm">
          Text to translate
          <textarea aria-label="Text to translate" className="input-dark" rows={4} value={text} onChange={(e) => setText(e.target.value)} {...FIELDS.translateText.text} />
        </label>
        <label className="block text-sm">
          Translate to
          <select aria-label="Target language" className="input-dark" value={target} onChange={(e) => setTarget(e.target.value)}>
            {LANGS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={tr.isPending || !text.trim()}>
          {tr.isPending ? "Translating…" : "Translate"}
        </button>
      </form>
      {tr.data && (
        <section className="panel px-4 py-4" aria-label="Translation result">
          <h3 className="font-display text-sm neon-text">{target.toUpperCase()}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{tr.data.translation}</p>
          <p className="mt-2 text-xs text-[var(--dim)]">Translated via {tr.data.source}</p>
          <button type="button" className="btn-ghost mt-3" onClick={() => void navigator.clipboard?.writeText(tr.data!.translation)}>
            Copy translation
          </button>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Music Generator (WebAudio)
const MOODS: Record<string, { scale: number[]; tempo: number; wave: OscillatorType }> = {
  Chill: { scale: [0, 2, 4, 7, 9], tempo: 320, wave: "sine" },
  Happy: { scale: [0, 2, 4, 5, 7, 9, 11], tempo: 220, wave: "triangle" },
  Focus: { scale: [0, 3, 5, 7, 10], tempo: 400, wave: "sine" },
  Epic: { scale: [0, 2, 3, 5, 7, 8, 10], tempo: 260, wave: "sawtooth" },
};

export function MusicPage() {
  const [mood, setMood] = useState<keyof typeof MOODS>("Chill");
  const [playing, setPlaying] = useState(false);
  const [trackName, setTrackName] = useState("");
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [downloadUrl, setDownloadUrl] = useState("");

  function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setPlaying(false);
  }

  useEffect(() => () => stop(), []);

  function generate() {
    stop();
    setDownloadUrl("");
    const cfg = MOODS[mood] ?? { scale: [0, 2, 4, 7, 9], tempo: 320, wave: "sine" as OscillatorType };
    const actx = ctxRef.current ?? new AudioContext();
    ctxRef.current = actx;
    void actx.resume();
    // Record the generated track so it can be downloaded.
    try {
      const dest = actx.createMediaStreamDestination();
      const master = actx.createGain();
      master.gain.value = 0.5;
      master.connect(actx.destination);
      master.connect(dest);
      const rec = new MediaRecorder(dest.stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setDownloadUrl(URL.createObjectURL(blob));
      };
      recorderRef.current = rec;
      rec.start();
      playLoop(actx, master, cfg);
    } catch {
      playLoop(actx, actx.destination, cfg);
    }
    setTrackName(`${mood} loop · generated ${new Date().toLocaleTimeString()}`);
    setPlaying(true);
  }

  function playLoop(actx: AudioContext, out: AudioNode, cfg: (typeof MOODS)[keyof typeof MOODS]) {
    const base = 220; // A3
    const melody: number[] = [];
    let seed = mood.length * 7 + 13;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 32; i++) {
      const deg = cfg.scale[Math.floor(rand() * cfg.scale.length)] ?? 0;
      const oct = rand() > 0.8 ? 12 : 0;
      melody.push(deg + oct);
    }
    let step = 0;
    const tick = () => {
      const semi = melody[step % melody.length] ?? 0;
      const freq = base * Math.pow(2, semi / 12);
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = cfg.wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + cfg.tempo / 1000);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(actx.currentTime + cfg.tempo / 1000);
      if (step % 4 === 0) {
        const bass = actx.createOscillator();
        const bg = actx.createGain();
        bass.type = "sine";
        bass.frequency.value = base / 2;
        bg.gain.setValueAtTime(0.15, actx.currentTime);
        bg.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + (cfg.tempo * 4) / 1000);
        bass.connect(bg);
        bg.connect(out);
        bass.start();
        bass.stop(actx.currentTime + (cfg.tempo * 4) / 1000);
      }
      step += 1;
      if (step >= 64) stop();
    };
    tick();
    timerRef.current = window.setInterval(tick, cfg.tempo);
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Music Generator</h2>
      <p className="text-sm text-[var(--dim)]">
        Pick a mood — {`QWARA`} composes an original loop on the spot and plays it with your device's audio. Works offline, no files leave your device.
      </p>
      <div className="panel space-y-3 px-4 py-4">
        <label className="block text-sm">
          Mood
          <select aria-label="Music mood" className="input-dark" value={mood} onChange={(e) => setMood(e.target.value as keyof typeof MOODS)}>
            {Object.keys(MOODS).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn-primary grow" onClick={generate} disabled={playing}>
            {playing ? "Playing…" : "Generate & play"}
          </button>
          <button type="button" className="btn-ghost" onClick={stop} disabled={!playing}>
            Stop
          </button>
        </div>
        {trackName && <p className="text-sm text-[var(--dim)]">{trackName}</p>}
        {downloadUrl && (
          <a className="btn-ghost inline-block" href={downloadUrl} download="qwara-music.webm">
            Download recording (WebM)
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Prompt Library
export function PromptsPage({ token, go }: PageProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const list = useQuery({
    queryKey: ["my-prompts"],
    queryFn: () => api.listMyPrompts({ token }),
  });
  const save = useMutation({
    mutationFn: () => api.savePromptToLibrary({ token, title: title.trim(), text: text.trim() }),
    onSuccess: () => {
      setTitle("");
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["my-prompts"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.deleteMyPrompt({ token, id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-prompts"] }),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Prompt Library</h2>
      <form
        className="panel space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          save.mutate();
        }}
      >
        <label className="block text-sm">
          Title
          <input aria-label="Prompt title" className="input-dark" value={title} onChange={(e) => setTitle(e.target.value)} {...FIELDS.savePromptToLibrary.title} />
        </label>
        <label className="block text-sm">
          Prompt
          <textarea aria-label="Prompt text" className="input-dark" rows={3} value={text} onChange={(e) => setText(e.target.value)} {...FIELDS.savePromptToLibrary.text} />
        </label>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button type="submit" className="btn-primary" disabled={save.isPending || !title.trim() || !text.trim()}>
          Save prompt
        </button>
      </form>
      <section className="space-y-3" aria-label="Saved prompts">
        {list.isPending && <p className="text-sm text-[var(--dim)]">Loading your library…</p>}
        {list.error && <p className="text-sm" style={{ color: "var(--danger)" }}>Could not load your library. Try again.</p>}
        {list.data?.prompts.length === 0 && (
          <p className="text-sm text-[var(--dim)]">No saved prompts yet. Save your best starters here and reuse them in chat.</p>
        )}
        {list.data?.prompts.map((p) => (
          <div key={p.id} className="panel px-4 py-3">
            <p className="font-display text-sm">{p.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--dim)]">{p.text}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setChatPrefill(p.text);
                  go("chat");
                }}
              >
                Use in chat
              </button>
              <button type="button" className="btn-ghost" onClick={() => del.mutate(p.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Desktop Controls
const DESKTOP_APPS = ["Notepad", "Calculator", "Browser", "File Explorer", "Paint", "Terminal"];
const SYSTEM_ACTIONS = ["Volume up", "Volume down", "Mute", "Lock screen", "Shutdown", "Restart"];

export function DesktopPage() {
  const [pending, setPending] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const disruptive = pending === "Shutdown" || pending === "Restart";
  function queue(action: string) {
    setLog((prev) => [`Queued for the desktop companion: ${action}`, ...prev].slice(0, 8));
    setPending("");
  }
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Desktop Controls</h2>
      <div className="panel px-4 py-4 text-sm leading-relaxed">
        <p>
          These controls talk to the <strong>QWARA desktop companion</strong> (the Electron build — see Install &amp; Setup).
          The web app can only queue a fixed list of safe commands; it never runs arbitrary text as a system command, and
          disruptive actions always need confirmation.
        </p>
        <p className="mt-2 text-[var(--dim)]">
          In this web version the buttons queue commands and show the confirmation flow. On a PC signed in to the desktop
          companion, the same queue performs the action. Voice input, speech output and the wake phrase are not available on
          Windows 7 (they need a modern browser) — everything else in the companion is designed to run on it.
        </p>
      </div>
      <section className="panel px-4 py-4" aria-label="Open an app">
        <h3 className="font-display text-sm neon-text">OPEN AN APP</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {DESKTOP_APPS.map((a) => (
            <button key={a} type="button" className="btn-ghost" onClick={() => queue(`Open ${a}`)}>
              {a}
            </button>
          ))}
        </div>
      </section>
      <section className="panel px-4 py-4" aria-label="System controls">
        <h3 className="font-display text-sm neon-text">SYSTEM</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {SYSTEM_ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              className="btn-ghost"
              onClick={() => {
                if (a === "Shutdown" || a === "Restart" || a === "Lock screen") setPending(a);
                else queue(a);
              }}
            >
              {a}
            </button>
          ))}
        </div>
        {pending && (
          <div className="panel-raised mt-4 px-3 py-3" role="alertdialog" aria-label={`Confirm ${pending}`}>
            <p className="text-sm">
              {disruptive
                ? `"${pending}" will interrupt everything on the PC. Are you sure?`
                : `Confirm "${pending}"?`}
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-primary" onClick={() => queue(pending)}>
                Yes, {pending.toLowerCase()}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setPending("")}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
      {log.length > 0 && (
        <section className="panel px-4 py-4" aria-label="Command queue">
          <h3 className="font-display text-sm neon-text">QUEUE</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--dim)]">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
