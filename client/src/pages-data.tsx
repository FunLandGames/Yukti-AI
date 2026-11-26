// Everyday data pages: Notes, Reminders, Dictionary, Facts & Jokes, QR Code,
// URL Shortener, News, Weather, Crypto, Cricket.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { api } from "./api";
import type { PageProps } from "./appctx";
import {
BRAND,
SAMPLE_CRICKET,
localNotes,
localReminders,
newClientId,
type LocalNote,
type LocalReminder,
} from "./lib";

const FIELDS = actionFields<typeof Actions>();

// ---------------------------------------------------------------- Notes (offline-first)
export function NotesPage({ token }: PageProps) {
  const [notes, setNotes] = useState<LocalNote[]>(() =>
    localNotes.all().filter((n) => !n.deleted),
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState("Saved on this device");
  const allRef = useRef<LocalNote[]>(localNotes.all());

  const sync = useMutation({
    mutationFn: (list: LocalNote[]) =>
      api.syncNotes({
        token,
        notes: list.map((n) => ({
          clientId: n.clientId,
          title: n.title,
          body: n.body,
          updatedAt: n.updatedAt,
          deleted: n.deleted ?? false,
        })),
      }),
    onSuccess: (d) => {
      allRef.current = d.notes;
      localNotes.saveAll(d.notes);
      setNotes(d.notes);
      setSyncState("Synced to your account");
    },
    onError: () => setSyncState("Offline — saved on this device, will sync later"),
  });

  useEffect(() => {
    sync.mutate(allRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: LocalNote[]) {
    allRef.current = next;
    localNotes.saveAll(next);
    setNotes(next.filter((n) => !n.deleted));
    sync.mutate(next);
  }

  function saveNote() {
    if (!title.trim() && !body.trim()) return;
    const now = Date.now();
    if (editingId) {
      persist(
        allRef.current.map((n) =>
          n.clientId === editingId
            ? { ...n, title: title.trim(), body: body.trim(), updatedAt: now }
            : n,
        ),
      );
      setEditingId(null);
    } else {
      persist([
        { clientId: newClientId(), title: title.trim(), body: body.trim(), updatedAt: now },
        ...allRef.current,
      ]);
    }
    setTitle("");
    setBody("");
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Notes</h2>
      <p className="text-sm text-[var(--dim)]">
        Notes work fully offline — they're saved on this device instantly and sync to your account when you're back online. Status: {syncState}.
      </p>
      <div className="panel space-y-3 px-4 py-4">
        <label className="block text-sm">
          Title
          <input aria-label="Note title" className="input-dark" value={title} onChange={(e) => setTitle(e.target.value)} {...FIELDS.syncNotes.notes.title} />
        </label>
        <label className="block text-sm">
          Note
          <textarea aria-label="Note text" className="input-dark" rows={4} value={body} onChange={(e) => setBody(e.target.value)} {...FIELDS.syncNotes.notes.body} />
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={saveNote}>
            {editingId ? "Save changes" : "Add note"}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setBody("");
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </div>
      <section className="space-y-3" aria-label="Your notes">
        {notes.length === 0 && <p className="text-sm text-[var(--dim)]">No notes yet. Write your first one above.</p>}
        {notes.map((n) => (
          <article key={n.clientId} className="panel px-4 py-3">
            <h3 className="font-display text-sm">{n.title || "Untitled"}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--dim)]">{n.body}</p>
            <p className="mt-1 text-xs text-[var(--dim)]">
              Updated {new Date(n.updatedAt).toLocaleString()}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditingId(n.clientId);
                  setTitle(n.title);
                  setBody(n.body);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  persist(
                    allRef.current.map((x) =>
                      x.clientId === n.clientId
                        ? { ...x, deleted: true, updatedAt: Date.now() }
                        : x,
                    ),
                  )
                }
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Reminders (offline-first)
export function RemindersPage({ token }: PageProps) {
  const [items, setItems] = useState<LocalReminder[]>(() =>
    localReminders.all().filter((r) => !r.deleted),
  );
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [syncState, setSyncState] = useState("Saved on this device");
  const allRef = useRef<LocalReminder[]>(localReminders.all());

  const sync = useMutation({
    mutationFn: (list: LocalReminder[]) =>
      api.syncReminders({
        token,
        reminders: list.map((r) => ({
          clientId: r.clientId,
          text: r.text,
          dueText: r.dueText,
          done: r.done,
          updatedAt: r.updatedAt,
          deleted: r.deleted ?? false,
        })),
      }),
    onSuccess: (d) => {
      allRef.current = d.reminders;
      localReminders.saveAll(d.reminders);
      setItems(d.reminders);
      setSyncState("Synced to your account");
    },
    onError: () => setSyncState("Offline — saved on this device, will sync later"),
  });

  useEffect(() => {
    sync.mutate(allRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: LocalReminder[]) {
    allRef.current = next;
    localReminders.saveAll(next);
    setItems(next.filter((r) => !r.deleted));
    sync.mutate(next);
  }

  const open = items.filter((r) => !r.done);
  const done = items.filter((r) => r.done);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Reminders & To-Do</h2>
      <p className="text-sm text-[var(--dim)]">
        Works offline like Notes — saved on this device first, synced when online. Status: {syncState}.
      </p>
      <form
        className="panel flex flex-wrap items-end gap-2 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          persist([
            {
              clientId: newClientId(),
              text: text.trim(),
              dueText: due,
              done: false,
              updatedAt: Date.now(),
            },
            ...allRef.current,
          ]);
          setText("");
          setDue("");
        }}
      >
        <label className="grow text-sm">
          Task
          <input aria-label="Task" className="input-dark" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Revise physics chapter 4" {...FIELDS.syncReminders.reminders.text} />
        </label>
        <label className="text-sm">
          Due (optional)
          <input aria-label="Due date and time" type="datetime-local" className="input-dark" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary">Add</button>
      </form>
      <section aria-label="Open tasks" className="space-y-2">
        {open.length === 0 && <p className="text-sm text-[var(--dim)]">Nothing pending. Add a task above.</p>}
        {open.map((r) => (
          <div key={r.clientId} className="panel flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              aria-label={`Mark done: ${r.text}`}
              checked={false}
              onChange={() =>
                persist(
                  allRef.current.map((x) =>
                    x.clientId === r.clientId ? { ...x, done: true, updatedAt: Date.now() } : x,
                  ),
                )
              }
            />
            <div className="grow">
              <p className="text-sm">{r.text}</p>
              {r.dueText && (
                <p className="text-xs text-[var(--dim)]">Due {new Date(r.dueText).toLocaleString()}</p>
              )}
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                persist(
                  allRef.current.map((x) =>
                    x.clientId === r.clientId ? { ...x, deleted: true, updatedAt: Date.now() } : x,
                  ),
                )
              }
            >
              Delete
            </button>
          </div>
        ))}
      </section>
      {done.length > 0 && (
        <section aria-label="Completed tasks" className="space-y-2">
          <h3 className="font-display text-sm text-[var(--dim)]">COMPLETED</h3>
          {done.map((r) => (
            <div key={r.clientId} className="panel flex items-center gap-3 px-4 py-2 opacity-70">
              <input
                type="checkbox"
                aria-label={`Reopen: ${r.text}`}
                checked
                onChange={() =>
                  persist(
                    allRef.current.map((x) =>
                      x.clientId === r.clientId ? { ...x, done: false, updatedAt: Date.now() } : x,
                    ),
                  )
                }
              />
              <p className="grow text-sm line-through">{r.text}</p>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  persist(
                    allRef.current.map((x) =>
                      x.clientId === r.clientId ? { ...x, deleted: true, updatedAt: Date.now() } : x,
                    ),
                  )
                }
              >
                Delete
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Dictionary
export function DictionaryPage({ token }: PageProps) {
  const [word, setWord] = useState("");
  const [error, setError] = useState("");
  const lookup = useMutation({
    mutationFn: () => api.dictionaryLookup({ token, word: word.trim() }),
    onError: (e) => setError(e instanceof Error ? e.message : "Dictionary is unavailable right now."),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Dictionary</h2>
      <form
        className="panel flex gap-2 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          lookup.mutate();
        }}
      >
        <label className="sr-only" htmlFor="dict-word">Word to look up</label>
        <input id="dict-word" className="input-dark grow" value={word} onChange={(e) => setWord(e.target.value)} placeholder="Type an English word…" {...FIELDS.dictionaryLookup.word} />
        <button type="submit" className="btn-primary" disabled={lookup.isPending || !word.trim()}>
          {lookup.isPending ? "Searching…" : "Look up"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
      )}
      {lookup.data && !lookup.data.found && (
        <p className="panel px-4 py-3 text-sm">No definition found for “{lookup.data.word}”. Check the spelling, or try the base form of the word.</p>
      )}
      {lookup.data?.found && (
        <section className="panel px-4 py-4" aria-label="Definition">
          <h3 className="font-display text-lg">
            {lookup.data.word}{" "}
            {lookup.data.phonetic && <span className="text-sm text-[var(--dim)]">{lookup.data.phonetic}</span>}
          </h3>
          <div className="mt-3 space-y-3">
            {lookup.data.meanings.map((m, i) => (
              <div key={i}>
                <p className="text-sm font-semibold neon-text">{m.partOfSpeech}</p>
                <p className="text-sm">{m.definition}</p>
                {m.example && <p className="text-sm italic text-[var(--dim)]">“{m.example}”</p>}
              </div>
            ))}
          </div>
          {lookup.data.synonyms.length > 0 && (
            <p className="mt-3 text-sm">
              <span className="font-semibold">Synonyms:</span> {lookup.data.synonyms.join(", ")}
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--dim)]">Source: Free Dictionary API (dictionaryapi.dev)</p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Facts & Jokes
export function FactsPage({ token }: PageProps) {
  const [error, setError] = useState("");
  const joke = useMutation({
    mutationFn: () => api.getFactOrJoke({ token, kind: "joke" as const }),
    onError: (e) => setError(e instanceof Error ? e.message : "Jokes are unavailable right now."),
  });
  const fact = useMutation({
    mutationFn: () => api.getFactOrJoke({ token, kind: "fact" as const }),
    onError: (e) => setError(e instanceof Error ? e.message : "Facts are unavailable right now."),
  });
  const current = joke.data ?? fact.data;
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Facts & Jokes</h2>
      <div className="panel space-y-3 px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => { setError(""); joke.mutate(); }} disabled={joke.isPending}>
            {joke.isPending ? "Fetching…" : "Tell me a joke"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { setError(""); fact.mutate(); }} disabled={fact.isPending}>
            {fact.isPending ? "Fetching…" : "Random fact"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        {current && (
          <div aria-live="polite">
            <p className="whitespace-pre-wrap text-base leading-relaxed">{current.text}</p>
            <p className="mt-2 text-xs text-[var(--dim)]">Source: {current.source}</p>
          </div>
        )}
        {!current && !error && (
          <p className="text-sm text-[var(--dim)]">Tap a button — jokes come from JokeAPI (safe mode) and facts from the Useless Facts API. Both are free and need internet.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- QR Code
export function QrPage() {
  const [text, setText] = useState("https://");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");
  async function generate() {
    setError("");
    try {
      const url = await QRCode.toDataURL(text.trim(), { width: 512, margin: 2 });
      setDataUrl(url);
    } catch {
      setError("Couldn't generate a QR code for that text. Try shorter text.");
    }
  }
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">QR Code Generator</h2>
      <div className="panel space-y-3 px-4 py-4">
        <label className="block text-sm">
          Text or link
          <input aria-label="Text or link for the QR code" className="input-dark" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <button type="button" className="btn-primary" onClick={() => void generate()} disabled={!text.trim()}>
          Generate QR code
        </button>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <p className="text-xs text-[var(--dim)]">Generated on your device — works offline, nothing is uploaded.</p>
      </div>
      {dataUrl && (
        <section className="panel px-4 py-4 text-center" aria-label="Your QR code">
          <img src={dataUrl} alt={`QR code for ${text}`} className="mx-auto w-56 rounded-lg bg-white p-2" />
          <a className="btn-ghost mt-3 inline-block" href={dataUrl} download="qwara-qr.png">
            Download QR image
          </a>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- URL Shortener
export function ShortenerPage({ token }: PageProps) {
  const [url, setUrl] = useState("");
  const [resolveCode, setResolveCode] = useState("");
  const [error, setError] = useState("");
  const links = useQuery({ queryKey: ["my-links"], queryFn: () => api.listMyLinks({ token }) });
  const create = useMutation({
    mutationFn: () => api.createShortLink({ token, url: url.trim() }),
    onSuccess: () => void links.refetch(),
    onError: (e) => setError(e instanceof Error ? e.message : "That URL doesn't look valid."),
  });
  const resolve = useMutation({
    mutationFn: () => api.resolveShortLink({ code: resolveCode.trim() }),
    onError: (e) => setError(e instanceof Error ? e.message : "Could not resolve that code."),
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">URL Shortener</h2>
      <form
        className="panel space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          create.mutate();
        }}
      >
        <label className="block text-sm">
          Long URL
          <input aria-label="Long URL to shorten" className="input-dark" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://very-long-link.example/page" {...FIELDS.createShortLink.url} />
        </label>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button type="submit" className="btn-primary" disabled={create.isPending || !url.trim()}>
          {create.isPending ? "Shortening…" : "Shorten"}
        </button>
        {create.data && (
          <p className="text-sm">
            Your short code: <strong className="neon-text">{create.data.code}</strong> — anyone with {BRAND.short} can open it from the resolver below.
          </p>
        )}
      </form>
      <form
        className="panel flex flex-wrap items-end gap-2 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          resolve.mutate();
        }}
      >
        <label className="grow text-sm">
          Open a short code
          <input aria-label="Short code to open" className="input-dark" value={resolveCode} onChange={(e) => setResolveCode(e.target.value)} placeholder="e.g. a1b2c3" {...FIELDS.resolveShortLink.code} />
        </label>
        <button type="submit" className="btn-ghost" disabled={resolve.isPending || !resolveCode.trim()}>
          Resolve
        </button>
        {resolve.data?.url && (
          <p className="w-full text-sm">
            Goes to:{" "}
            <a className="underline" href={resolve.data.url} target="_blank" rel="noreferrer">
              {resolve.data.url}
            </a>
          </p>
        )}
        {resolve.data && !resolve.data.url && (
          <p className="w-full text-sm" style={{ color: "var(--warn)" }}>
            No link found for that code.
          </p>
        )}
      </form>
      {(links.data?.links.length ?? 0) > 0 && (
        <section className="panel px-4 py-4" aria-label="Your short links">
          <h3 className="font-display text-sm neon-text">YOUR LINKS</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {links.data!.links.map((l) => (
              <li key={l.code} className="flex flex-wrap justify-between gap-2">
                <span>
                  <strong>{l.code}</strong> → <span className="text-[var(--dim)]">{l.url.slice(0, 60)}{l.url.length > 60 ? "…" : ""}</span>
                </span>
                <span className="text-[var(--dim)]">{l.clicks} clicks</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- News
const NEWS_CATS = ["top", "world", "technology", "business", "sport", "health"] as const;

export function NewsPage({ token }: PageProps) {
  const [cat, setCat] = useState<(typeof NEWS_CATS)[number]>("top");
  const news = useQuery({
    queryKey: ["news", cat],
    queryFn: () => api.getNews({ token, category: cat }),
    staleTime: 120000,
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">News</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="News category">
        {NEWS_CATS.map((c) => (
          <button key={c} type="button" className={cat === c ? "btn-primary" : "btn-ghost"} onClick={() => setCat(c)}>
            {c[0]!.toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      {news.isPending && <p className="text-sm text-[var(--dim)]">Loading headlines…</p>}
      {news.error && (
        <div className="panel px-4 py-3">
          <p className="text-sm" style={{ color: "var(--danger)" }}>News is unavailable right now. The BBC feed may be down or you're offline.</p>
          <button type="button" className="btn-ghost mt-2" onClick={() => void news.refetch()}>Try again</button>
        </div>
      )}
      <section className="space-y-3" aria-label="Headlines">
        {news.data?.items.map((item, i) => (
          <article key={i} className="panel px-4 py-3">
            <a className="font-medium underline-offset-2 hover:underline" href={item.link} target="_blank" rel="noreferrer">
              {item.title}
            </a>
            {item.description && <p className="mt-1 text-sm text-[var(--dim)]">{item.description}</p>}
            <p className="mt-1 text-xs text-[var(--dim)]">BBC News{item.pubDate ? ` · ${item.pubDate}` : ""}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Weather
export function WeatherPage({ token }: PageProps) {
  const [city, setCity] = useState("Delhi");
  const [queryCity, setQueryCity] = useState("Delhi");
  const weather = useQuery({
    queryKey: ["weather", queryCity],
    queryFn: () => api.getWeather({ token, city: queryCity }),
    staleTime: 300000,
  });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Weather</h2>
      <form
        className="panel flex gap-2 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setQueryCity(city.trim());
        }}
      >
        <label className="sr-only" htmlFor="weather-city">City</label>
        <input id="weather-city" className="input-dark grow" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City name — e.g. Mumbai, London, New York" {...FIELDS.getWeather.city} />
        <button type="submit" className="btn-primary" disabled={weather.isFetching}>
          {weather.isFetching ? "Loading…" : "Check"}
        </button>
      </form>
      {weather.error && (
        <p role="alert" className="panel px-4 py-3 text-sm" style={{ color: "var(--danger)" }}>
          Weather service is unavailable right now. Check your connection and try again.
        </p>
      )}
      {weather.data && !weather.data.found && (
        <p className="panel px-4 py-3 text-sm">Couldn't find a place called “{weather.data.place}”. Try the English spelling of the city.</p>
      )}
      {weather.data?.found && (
        <section className="panel px-4 py-4" aria-label="Weather result">
          <h3 className="font-display text-lg">
            {weather.data.place}, {weather.data.country}
          </h3>
          <p className="neon-text font-display mt-2 text-4xl">{weather.data.temp}°C</p>
          <p className="mt-1 text-sm">{weather.data.condition}</p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Humidity {weather.data.humidity}% · Wind {weather.data.wind} km/h
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {weather.data.days.map((d) => (
              <div key={d.date} className="panel-raised px-2 py-2 text-center text-sm">
                <p className="text-xs text-[var(--dim)]">{d.date.slice(5)}</p>
                <p className="font-semibold">{d.max}° / {d.min}°</p>
                <p className="text-xs text-[var(--dim)]">{d.condition}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--dim)]">Source: Open-Meteo (free, no API key)</p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Crypto
export function CryptoPage({ token }: PageProps) {
  const crypto = useQuery({
    queryKey: ["crypto"],
    queryFn: () => api.getCrypto({ token }),
    staleTime: 120000,
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Crypto Prices</h2>
        <button type="button" className="btn-ghost" onClick={() => void crypto.refetch()} disabled={crypto.isFetching}>
          {crypto.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {crypto.isPending && <p className="text-sm text-[var(--dim)]">Loading live prices…</p>}
      {crypto.error && (
        <p role="alert" className="panel px-4 py-3 text-sm" style={{ color: "var(--danger)" }}>
          {crypto.error instanceof Error ? crypto.error.message : "Crypto prices are unavailable right now."}
        </p>
      )}
      <section className="space-y-2" aria-label="Cryptocurrency prices">
        {crypto.data?.coins.map((c) => (
          <div key={c.id} className="panel flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-display text-sm">{c.name}</p>
              <p className="text-xs text-[var(--dim)]">24h change</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">${c.usd.toLocaleString()}</p>
              <p className="text-sm text-[var(--dim)]">₹{c.inr.toLocaleString()}</p>
            </div>
            <p className="font-semibold" style={{ color: c.change24h >= 0 ? "var(--good)" : "var(--danger)" }}>
              {c.change24h >= 0 ? "+" : ""}{c.change24h}%
            </p>
          </div>
        ))}
      </section>
      <p className="text-xs text-[var(--dim)]">
        Source: CoinGecko public API (free). Prices are information only, not financial advice.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Cricket
export function CricketPage({ token }: PageProps) {
  const [liveState, setLiveState] = useState<"trying" | "failed" | "ok">("trying");
  const [liveText, setLiveText] = useState("");
  const headlines = useQuery({
    queryKey: ["news", "sport"],
    queryFn: () => api.getNews({ token, category: "sport" }),
    staleTime: 120000,
  });

  useEffect(() => {
    let cancelled = false;
    // Per the product spec, cricket is attempted from the client because some
    // cricket APIs block server IPs. No credentials are involved.
    fetch("https://hs-consumer-api.espncricinfo.com/v1/pages/matches/current?lang=en&latest=true")
      .then(async (res) => {
        if (!res.ok) throw new Error("blocked");
        const data: unknown = await res.json();
        if (!cancelled) {
          setLiveText(JSON.stringify(data).slice(0, 400));
          setLiveState("ok");
        }
      })
      .catch(() => {
        if (!cancelled) setLiveState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Cricket Scorecards</h2>
      {liveState === "trying" && <p className="text-sm text-[var(--dim)]">Trying the live cricket feed from your browser…</p>}
      {liveState === "ok" && (
        <section className="panel px-4 py-4">
          <h3 className="font-display text-sm neon-text">LIVE FEED CONNECTED</h3>
          <p className="mt-2 text-sm text-[var(--dim)]">
            The live feed responded. Raw feed preview: {liveText}…
          </p>
        </section>
      )}
      {liveState === "failed" && (
        <section className="space-y-3" aria-label="Sample scorecards">
          <p className="panel px-4 py-3 text-sm" style={{ color: "var(--warn)" }}>
            The live cricket feed couldn't be reached from this device right now, so here's a clearly labelled sample scorecard. Real headlines are below.
          </p>
          {SAMPLE_CRICKET.matches.map((m) => (
            <article key={m.title} className="panel px-4 py-3">
              <h3 className="font-display text-sm">{m.title}</h3>
              <p className="text-xs" style={{ color: "var(--warn)" }}>{SAMPLE_CRICKET.label}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {m.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}
      <section aria-label="Sports headlines" className="space-y-3">
        <h3 className="font-display text-sm tracking-widest text-[var(--dim)]">SPORTS HEADLINES</h3>
        {headlines.isPending && <p className="text-sm text-[var(--dim)]">Loading headlines…</p>}
        {headlines.error && <p className="text-sm text-[var(--dim)]">Headlines unavailable right now.</p>}
        {headlines.data?.items.slice(0, 8).map((item, i) => (
          <article key={i} className="panel px-4 py-3">
            <a className="font-medium hover:underline" href={item.link} target="_blank" rel="noreferrer">
              {item.title}
            </a>
            <p className="mt-1 text-xs text-[var(--dim)]">BBC Sport</p>
          </article>
        ))}
      </section>
    </div>
  );
}
