// Games hub (Tic-Tac-Toe vs minimax AI, Snake, Memory Match, Typing Speed)
// and the shared Leaderboard. All points are submitted to the server, which
// validates and caps them — the browser can never set its own score.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { PageProps } from "./appctx";
import { useInterval } from "./lib";

type GameId = "tictactoe" | "snake" | "memory" | "typing";

function useScore(token: string | undefined) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const submit = useMutation({
    mutationFn: (args: { game: "snake" | "memory" | "typing" | "tictactoe" | "quiz"; points: number; detail: string }) =>
      api.submitScore({ token, ...args }),
    onSuccess: (d) => {
      setNote(d.accepted > 0 ? `+${d.accepted} points added to the leaderboard.` : "");
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: () => setNote("Score could not be saved (sign-in may have expired)."),
  });
  return { submit, note };
}

// ---------------------------------------------------------------- hub
export function GamesPage(props: PageProps) {
  const [game, setGame] = useState<GameId>("tictactoe");
  const games: Array<{ id: GameId; label: string; hint: string }> = [
    { id: "tictactoe", label: "Tic-Tac-Toe", hint: "Against a perfect AI — a draw is a win here" },
    { id: "snake", label: "Snake", hint: "10 points per apple" },
    { id: "memory", label: "Memory Match", hint: "Fewer moves = more points" },
    { id: "typing", label: "Typing Speed", hint: "WPM × accuracy = points" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Games Hub</h2>
        <button type="button" className="btn-ghost" onClick={() => props.go("leaderboard")}>
          Leaderboard
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Choose a game">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            className={game === g.id ? "btn-primary text-left" : "btn-ghost text-left"}
            onClick={() => setGame(g.id)}
          >
            <span className="font-display block text-sm">{g.label}</span>
            <span className="block text-xs opacity-80">{g.hint}</span>
          </button>
        ))}
      </div>
      {game === "tictactoe" && <TicTacToe {...props} />}
      {game === "snake" && <SnakeGame {...props} />}
      {game === "memory" && <MemoryGame {...props} />}
      {game === "typing" && <TypingGame {...props} />}
    </div>
  );
}

// ---------------------------------------------------------------- Tic-Tac-Toe (minimax)
type Cell = "X" | "O" | "";

function winnerOf(b: Cell[]): Cell | "draw" | "" {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const line of lines) {
    const [a = -1, c = -1, d = -1] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]!;
  }
  return b.every((c) => c !== "") ? "draw" : "";
}

function minimax(b: Cell[], isMax: boolean): number {
  const w = winnerOf(b);
  if (w === "O") return 10;
  if (w === "X") return -10;
  if (w === "draw") return 0;
  let best = isMax ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i] === "") {
      b[i] = isMax ? "O" : "X";
      const score = minimax(b, !isMax);
      b[i] = "";
      best = isMax ? Math.max(best, score) : Math.min(best, score);
    }
  }
  return best;
}

function bestMove(b: Cell[]): number {
  let bestScore = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (b[i] === "") {
      b[i] = "O";
      const score = minimax(b, false);
      b[i] = "";
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  return move;
}

function TicTacToe({ token }: PageProps) {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(""));
  const [status, setStatus] = useState("Your turn — you are X.");
  const [over, setOver] = useState(false);
  const { submit, note } = useScore(token);
  const submittedRef = useRef(false);

  function finish(b: Cell[]) {
    const w = winnerOf(b);
    if (!w) return false;
    setOver(true);
    if (w === "X") {
      setStatus("You beat the AI! That almost never happens.");
      if (!submittedRef.current) {
        submittedRef.current = true;
        submit.mutate({ game: "tictactoe", points: 30, detail: "Beat the AI" });
      }
    } else if (w === "O") {
      setStatus("The AI wins this round. It plays perfectly — try for a draw.");
    } else {
      setStatus("A draw against a perfect AI — well played!");
      if (!submittedRef.current) {
        submittedRef.current = true;
        submit.mutate({ game: "tictactoe", points: 10, detail: "Draw vs AI" });
      }
    }
    return true;
  }

  function play(i: number) {
    if (over || board[i] !== "") return;
    const next = [...board];
    next[i] = "X";
    if (finish(next)) {
      setBoard(next);
      return;
    }
    const ai = bestMove(next);
    if (ai >= 0) next[ai] = "O";
    finish(next);
    setBoard(next);
  }

  return (
    <section className="panel px-4 py-4" aria-label="Tic-Tac-Toe">
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
        {board.map((c, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Cell ${i + 1}${c ? `: ${c}` : ""}`}
            className="panel-raised font-display flex aspect-square items-center justify-center text-3xl"
            style={{ color: c === "X" ? "var(--accent)" : "var(--accent2)" }}
            onClick={() => play(i)}
            disabled={over || c !== ""}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-sm" aria-live="polite">{status}</p>
      {note && <p className="text-center text-sm neon-text">{note}</p>}
      <div className="mt-3 text-center">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setBoard(Array(9).fill(""));
            setOver(false);
            submittedRef.current = false;
            setStatus("Your turn — you are X.");
          }}
        >
          New game
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-[var(--dim)]">Win = 30 pts · Draw = 10 pts · the AI uses perfect minimax play.</p>
    </section>
  );
}

// ---------------------------------------------------------------- Snake
const GRID = 15;

function SnakeGame({ token }: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);
  const stateRef = useRef({
    snake: [{ x: 7, y: 7 }],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 11, y: 7 },
    apples: 0,
  });
  const { submit, note } = useScore(token);
  const submittedRef = useRef(false);

  function draw() {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const cell = canvas.width / GRID;
    g.fillStyle = "#04090f";
    g.fillRect(0, 0, canvas.width, canvas.height);
    const s = stateRef.current;
    g.fillStyle = "#e879f9";
    g.fillRect(s.food.x * cell + 2, s.food.y * cell + 2, cell - 4, cell - 4);
    s.snake.forEach((part, i) => {
      g.fillStyle = i === 0 ? "#22d3ee" : "#0e7490";
      g.fillRect(part.x * cell + 1, part.y * cell + 1, cell - 2, cell - 2);
    });
  }

  useEffect(() => {
    draw();
  }, []);

  useInterval(
    () => {
      const s = stateRef.current;
      s.dir = s.nextDir;
      const head = { x: s.snake[0]!.x + s.dir.x, y: s.snake[0]!.y + s.dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID || s.snake.some((p) => p.x === head.x && p.y === head.y)) {
        setRunning(false);
        setDead(true);
        if (!submittedRef.current && s.apples > 0) {
          submittedRef.current = true;
          submit.mutate({ game: "snake", points: s.apples * 10, detail: `${s.apples} apples` });
        }
        return;
      }
      s.snake.unshift(head);
      if (head.x === s.food.x && head.y === s.food.y) {
        s.apples += 1;
        setScore(s.apples * 10);
        let fx = Math.floor(Math.random() * GRID);
        let fy = Math.floor(Math.random() * GRID);
        while (s.snake.some((p) => p.x === fx && p.y === fy)) {
          fx = Math.floor(Math.random() * GRID);
          fy = Math.floor(Math.random() * GRID);
        }
        s.food = { x: fx, y: fy };
      } else {
        s.snake.pop();
      }
      draw();
    },
    running ? 150 : null,
  );

  function setDir(x: number, y: number) {
    const s = stateRef.current;
    if (s.dir.x === -x && s.dir.y === -y) return;
    s.nextDir = { x, y };
  }

  function restart() {
    stateRef.current = {
      snake: [{ x: 7, y: 7 }],
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: { x: 11, y: 7 },
      apples: 0,
    };
    submittedRef.current = false;
    setScore(0);
    setDead(false);
    setRunning(true);
    draw();
  }

  return (
    <section className="panel px-4 py-4 text-center" aria-label="Snake">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="mx-auto w-full max-w-[300px] rounded-lg"
        style={{ border: "1px solid var(--border)", touchAction: "none" }}
        tabIndex={0}
        aria-label="Snake board. Use arrow keys or the on-screen buttons."
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") setDir(0, -1);
          if (e.key === "ArrowDown") setDir(0, 1);
          if (e.key === "ArrowLeft") setDir(-1, 0);
          if (e.key === "ArrowRight") setDir(1, 0);
        }}
      />
      <p className="mt-2 text-sm" aria-live="polite">
        Score: <strong className="neon-text">{score}</strong>
        {dead ? " · Game over!" : ""}
      </p>
      {note && <p className="text-sm neon-text">{note}</p>}
      <div className="mt-3 flex justify-center gap-2">
        {!running && (
          <button type="button" className="btn-primary" onClick={restart}>
            {dead || score > 0 ? "Play again" : "Start"}
          </button>
        )}
        {running && (
          <button type="button" className="btn-ghost" onClick={() => setRunning(false)}>
            Pause
          </button>
        )}
      </div>
      <div className="mx-auto mt-3 grid max-w-[180px] grid-cols-3 gap-1" aria-label="Snake controls">
        <span />
        <button type="button" className="btn-ghost" aria-label="Move up" onClick={() => setDir(0, -1)}>↑</button>
        <span />
        <button type="button" className="btn-ghost" aria-label="Move left" onClick={() => setDir(-1, 0)}>←</button>
        <button type="button" className="btn-ghost" aria-label="Move down" onClick={() => setDir(0, 1)}>↓</button>
        <button type="button" className="btn-ghost" aria-label="Move right" onClick={() => setDir(1, 0)}>→</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Memory Match
const SYMBOLS = ["★", "♥", "●", "▲", "◆", "✚", "♞", "☀"];

function shuffledDeck(): Array<{ id: number; symbol: string }> {
  const cards = [...SYMBOLS, ...SYMBOLS].map((symbol, i) => ({ id: i, symbol }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i]!;
    cards[i] = cards[j]!;
    cards[j] = tmp;
  }
  return cards;
}

function MemoryGame({ token }: PageProps) {
  const [deck, setDeck] = useState(shuffledDeck);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const { submit, note } = useScore(token);
  const submittedRef = useRef(false);

  function flip(card: { id: number; symbol: string }) {
    if (finished || open.includes(card.id) || matched.has(card.symbol)) return;
    if (startedAt === null) setStartedAt(Date.now());
    const next = [...open, card.id];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((id) => deck.find((c) => c.id === id)!);
      if (a && b && a.symbol === b.symbol) {
        const newMatched = new Set(matched);
        newMatched.add(a.symbol);
        setMatched(newMatched);
        setOpen([]);
        if (newMatched.size === SYMBOLS.length) {
          setFinished(true);
          const seconds = Math.max(1, Math.round((Date.now() - (startedAt ?? Date.now())) / 1000));
          const points = Math.max(20, 320 - (moves + 1) * 10 - Math.floor(seconds / 2));
          if (!submittedRef.current) {
            submittedRef.current = true;
            submit.mutate({ game: "memory", points, detail: `${moves + 1} moves, ${seconds}s` });
          }
        }
      } else {
        setTimeout(() => setOpen([]), 700);
      }
    }
  }

  return (
    <section className="panel px-4 py-4" aria-label="Memory Match">
      <div className="mx-auto grid max-w-sm grid-cols-4 gap-2">
        {deck.map((card) => {
          const isOpen = open.includes(card.id) || matched.has(card.symbol);
          return (
            <button
              key={card.id}
              type="button"
              aria-label={isOpen ? `Card showing ${card.symbol}` : "Hidden card"}
              className="panel-raised flex aspect-square items-center justify-center text-2xl"
              style={{ color: matched.has(card.symbol) ? "var(--good)" : "var(--accent)" }}
              onClick={() => flip(card)}
            >
              {isOpen ? card.symbol : "?"}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm" aria-live="polite">
        Moves: {moves} · Matched: {matched.size}/{SYMBOLS.length}
        {finished ? " · Complete!" : ""}
      </p>
      {note && <p className="text-center text-sm neon-text">{note}</p>}
      <div className="mt-2 text-center">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setDeck(shuffledDeck());
            setOpen([]);
            setMatched(new Set());
            setMoves(0);
            setStartedAt(null);
            setFinished(false);
            submittedRef.current = false;
          }}
        >
          New game
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Typing Speed
const SENTENCES = [
  "The quick brown fox jumps over the lazy dog near the river bank.",
  "Practice makes progress, and small daily steps build big skills.",
  "Technology works best when it helps people learn and create more.",
  "A good plan today is better than a perfect plan tomorrow.",
  "Reading every day builds a strong mind and a rich vocabulary.",
];

function TypingGame({ token }: PageProps) {
  const [sentence, setSentence] = useState(SENTENCES[0]!);
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState("");
  const { submit, note } = useScore(token);
  const submittedRef = useRef(false);

  function onType(value: string) {
    if (startedAt === null && value.length > 0) setStartedAt(Date.now());
    setTyped(value);
    if (value.length >= sentence.length && startedAt !== null) {
      const seconds = Math.max(1, (Date.now() - startedAt) / 1000);
      const words = sentence.split(" ").length;
      const wpm = Math.round((words / seconds) * 60);
      let correctChars = 0;
      for (let i = 0; i < sentence.length; i++) {
        if (value[i] === sentence[i]) correctChars += 1;
      }
      const accuracy = Math.round((correctChars / sentence.length) * 100);
      const points = Math.round(wpm * (accuracy / 100));
      setResult(`${wpm} WPM · ${accuracy}% accuracy · ${points} points`);
      if (!submittedRef.current && points > 0) {
        submittedRef.current = true;
        submit.mutate({ game: "typing", points, detail: `${wpm} WPM, ${accuracy}%` });
      }
    }
  }

  return (
    <section className="panel px-4 py-4" aria-label="Typing speed test">
      <p className="panel-raised px-3 py-3 font-mono text-base leading-relaxed">{sentence}</p>
      <label className="mt-3 block text-sm">
        Type the sentence above
        <textarea
          aria-label="Type the sentence above"
          className="input-dark"
          rows={3}
          value={typed}
          onChange={(e) => onType(e.target.value)}
          placeholder="Start typing here — the timer starts on your first keystroke."
        />
      </label>
      {result && <p className="mt-2 text-sm neon-text" aria-live="polite">{result}</p>}
      {note && <p className="text-sm neon-text">{note}</p>}
      <button
        type="button"
        className="btn-primary mt-3"
        onClick={() => {
          setSentence(SENTENCES[Math.floor(Math.random() * SENTENCES.length)]!);
          setTyped("");
          setStartedAt(null);
          setResult("");
          submittedRef.current = false;
        }}
      >
        New sentence
      </button>
    </section>
  );
}

// ---------------------------------------------------------------- Leaderboard
const GAME_LABELS: Record<string, string> = {
  snake: "Snake",
  memory: "Memory",
  typing: "Typing",
  tictactoe: "Tic-Tac-Toe",
  quiz: "Quiz",
};

export function LeaderboardPage(_props: PageProps) {
  const lb = useQuery({ queryKey: ["leaderboard"], queryFn: () => api.getLeaderboard({}) });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Leaderboard</h2>
        <button type="button" className="btn-ghost" onClick={() => void lb.refetch()} disabled={lb.isFetching}>
          {lb.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {lb.isPending && <p className="text-sm text-[var(--dim)]">Loading the leaderboard…</p>}
      {lb.error && (
        <p role="alert" className="panel px-4 py-3 text-sm" style={{ color: "var(--danger)" }}>
          The leaderboard couldn't load. Check your connection and refresh.
        </p>
      )}
      {lb.data && lb.data.players.length === 0 && (
        <p className="panel px-4 py-3 text-sm text-[var(--dim)]">
          No scores yet — be the first on the board. Play a game or finish a quiz to earn points.
        </p>
      )}
      {lb.data && lb.data.players.length > 0 && (
        <section className="panel px-4 py-4" aria-label="Top players">
          <ol className="space-y-2">
            {lb.data.players.map((p, i) => (
              <li key={p.displayName} className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2 last:border-0">
                <span className="text-sm">
                  <strong className="neon-text">{i + 1}.</strong> {p.displayName}
                  <span className="block text-xs text-[var(--dim)]">
                    {Object.entries(p.best)
                      .map(([g, v]) => `${GAME_LABELS[g] ?? g}: ${v}`)
                      .join(" · ")}
                  </span>
                </span>
                <span className="font-display neon-text">{p.total} pts</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {lb.data && lb.data.recent.length > 0 && (
        <section className="panel px-4 py-4" aria-label="Recent scores">
          <h3 className="font-display text-sm neon-text">RECENT SCORES</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {lb.data.recent.map((r, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {r.displayName} · {GAME_LABELS[r.game] ?? r.game}
                  {r.detail ? ` · ${r.detail}` : ""}
                </span>
                <span>+{r.points}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-[var(--dim)]">
        Scores are validated on the server (per-game caps, quiz answers scored server-side) — nobody can edit their own points from the browser.
      </p>
    </div>
  );
}
