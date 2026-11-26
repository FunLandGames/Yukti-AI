// QWARA AI app shell: sign-in/sign-up gate, maintenance mode, collapsible
// sidebar navigation, and page routing. The product name comes from BRAND in
// ./lib — a rename is a one-line change there.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { api } from "./api";
import type { Page } from "./appctx";
import { BRAND, getToken, setToken, type SessionUser } from "./lib";
import {
firebaseErrorMessage,
firebaseFreshIdToken,
firebaseGoogleSignIn,
firebasePhoneConfirmOtp,
firebasePhoneSendOtp,
firebaseResendVerification,
firebaseSignIn as fbSignIn,
firebaseSignOut,
firebaseSignUp as fbSignUp,
setFirebaseConfig,
} from "./firebase";
import { DashboardPage, ChatPage } from "./pages-core";
import { QuizPage, FocusTimerPage, HomeworkPage, YouTubePage, OcrPage } from "./pages-study";
import {
ImagePage, PdfChatPage, CodePage, PythonPage, TranslatePage, MusicPage,
PromptsPage, DesktopPage,
} from "./pages-tools";
import {
NotesPage, RemindersPage, DictionaryPage, FactsPage, QrPage, ShortenerPage,
NewsPage, WeatherPage, CryptoPage, CricketPage,
} from "./pages-data";
import { GamesPage, LeaderboardPage } from "./pages-games";
import { ProfilePage, AboutPage, FeedbackPage, InstallPage, AdminPage } from "./pages-info";

const FIELDS = actionFields<typeof Actions>();

const NAV: Array<{ group: string; items: Array<{ page: Page; label: string }> }> = [
  {
    group: "Assistant",
    items: [
      { page: "chat", label: "Chat with Yukti" },
      { page: "dashboard", label: "Home" },
    ],
  },
  {
    group: "My things",
    items: [
      { page: "notes", label: "My Notes" },
      { page: "reminders", label: "Reminders" },
      { page: "games", label: "Games" },
      { page: "leaderboard", label: "Leaderboard" },
    ],
  },
  {
    group: "My account",
    items: [
      { page: "profile", label: "Profile" },
      { page: "feedback", label: "Feedback" },
      { page: "about", label: "About" },
      { page: "install", label: "Install & Setup" },
    ],
  },
];

// Everything else lives behind one "All tools" toggle — most people never
// need it, because Yukti can do or open all of these from chat.
const TOOLS_NAV: Array<{ page: Page; label: string }> = [
  { page: "homework", label: "Homework Help" },
  { page: "quiz", label: "Play a Quiz" },
  { page: "focus", label: "Study Timer" },
  { page: "youtube", label: "Video Summary" },
  { page: "ocr", label: "Photo to Text" },
  { page: "image", label: "Make a Picture" },
  { page: "music", label: "Make Music" },
  { page: "code", label: "Write Code" },
  { page: "python", label: "Run Python" },
  { page: "pdf", label: "Ask a PDF" },
  { page: "translate", label: "Translate" },
  { page: "news", label: "News" },
  { page: "weather", label: "Weather" },
  { page: "cricket", label: "Cricket Scores" },
  { page: "crypto", label: "Coin Prices" },
  { page: "dictionary", label: "Dictionary" },
  { page: "facts", label: "Facts & Jokes" },
  { page: "qr", label: "QR Codes" },
  { page: "shortener", label: "Shorten a Link" },
  { page: "prompts", label: "Saved Prompts" },
  { page: "desktop", label: "Desktop Controls" },
];

export function App() {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | undefined>(() => getToken());
  const [page, setPage] = useState<Page>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => api.getBootstrap({}),
  });

  useEffect(() => {
    if (bootstrap.data) {
      setFirebaseConfig(bootstrap.data.firebase.config);
    }
  }, [bootstrap.data]);
  const session = useQuery({
    queryKey: ["session", token],
    queryFn: () => api.getSession({ token }),
    enabled: !!token,
  });
  const user: SessionUser | null = session.data?.user ?? null;

  useEffect(() => {
    if (token && session.data && !session.data.user) {
      setToken(null);
      setTokenState(undefined);
    }
  }, [token, session.data]);

  const signOut = useMutation({
    mutationFn: async () => {
      await firebaseSignOut();
      return api.signOut({ token });
    },
    onSettled: () => {
      setToken(null);
      setTokenState(undefined);
      queryClient.clear();
    },
  });

  function onAuthed(newToken: string) {
    setToken(newToken);
    setTokenState(newToken);
    setPage("chat");
  }

  function go(p: Page) {
    setPage(p);
    setSidebarOpen(false); // auto-close on mobile after choosing a page
  }

  if (bootstrap.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="reactor mx-auto" aria-hidden="true" />
          <p className="font-display neon-text mt-4 tracking-widest">{BRAND.name}</p>
          <p className="mt-1 text-sm text-[var(--dim)]">Booting systems…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        reviews={bootstrap.data?.reviews ?? []}
        maintenance={bootstrap.data?.maintenance ?? false}
        maintenanceMessage={bootstrap.data?.maintenanceMessage ?? ""}
        firebaseEnabled={bootstrap.data?.firebase.enabled ?? false}
        onAuthed={onAuthed}
      />
    );
  }

  // New accounts must verify their email before using the app (the owner
  // asked for this). Admins are never locked out of their own app.
  if (!user.emailVerified && user.role !== "admin") {
    return (
      <VerifyGate
        token={token}
        user={user}
        onVerified={() => void session.refetch()}
        onSignOut={() => signOut.mutate()}
      />
    );
  }

  if (bootstrap.data?.maintenance && user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="panel max-w-md px-6 py-8 text-center">
          <div className="reactor mx-auto" aria-hidden="true" />
          <h1 className="font-display neon-text mt-4 text-xl">MAINTENANCE MODE</h1>
          <p className="mt-2 text-sm text-[var(--dim)]">{bootstrap.data.maintenanceMessage}</p>
          <p className="mt-3 text-sm">Signed in as {user.displayName}</p>
          <button type="button" className="btn-ghost mt-4" onClick={() => signOut.mutate()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const pageProps = {
    token,
    user,
    go,
    refreshUser: () => void session.refetch(),
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 pt-safe">
        <button
          type="button"
          className="btn-ghost"
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰
        </button>
        <span className="font-display neon-text text-lg tracking-widest">{BRAND.name}</span>
        <span className="dot-live" aria-label="Systems online" />
        <span className="ml-auto hidden text-sm text-[var(--dim)] sm:block">
          {user.displayName}
          {user.role === "admin" ? " · Admin" : ""}
        </span>
        <button type="button" className="btn-ghost" onClick={() => signOut.mutate()}>
          Sign out
        </button>
      </header>

      <div className="mx-auto flex max-w-6xl items-start">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <nav
          aria-label="Main navigation"
          className={`fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] px-3 py-4 transition-transform lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:shrink-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <p className="font-display neon-text px-2 text-sm tracking-widest">{BRAND.name}</p>
          <p className="px-2 pb-3 text-xs text-[var(--dim)]">by {BRAND.creator}</p>
          {NAV.map((group) => (
            <div key={group.group} className="mb-3">
              <p className="px-2 pb-1 text-xs font-semibold tracking-widest text-[var(--dim)]">
                {group.group.toUpperCase()}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => go(item.page)}
                  aria-current={page === item.page ? "page" : undefined}
                  className="block w-full rounded-lg px-2 py-2 text-left text-sm"
                  style={
                    page === item.page
                      ? { background: "var(--surface2)", color: "var(--accent)" }
                      : undefined
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <div className="mb-3">
            <button
              type="button"
              className="block w-full rounded-lg px-2 py-2 text-left text-sm"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((v) => !v)}
            >
              <span className="text-xs font-semibold tracking-widest text-[var(--dim)]">ALL TOOLS</span>{" "}
              <span aria-hidden="true">{toolsOpen ? "▾" : "▸"}</span>
            </button>
            {toolsOpen &&
              TOOLS_NAV.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => go(item.page)}
                  aria-current={page === item.page ? "page" : undefined}
                  className="block w-full rounded-lg px-2 py-2 text-left text-sm"
                  style={
                    page === item.page
                      ? { background: "var(--surface2)", color: "var(--accent)" }
                      : undefined
                  }
                >
                  {item.label}
                </button>
              ))}
          </div>
          {user.role === "admin" && (
            <div className="mb-3">
              <p className="px-2 pb-1 text-xs font-semibold tracking-widest text-[var(--dim)]">SYSTEM</p>
              <button
                type="button"
                onClick={() => go("admin")}
                aria-current={page === "admin" ? "page" : undefined}
                className="block w-full rounded-lg px-2 py-2 text-left text-sm"
                style={page === "admin" ? { background: "var(--surface2)", color: "var(--accent)" } : undefined}
              >
                Admin Control
              </button>
            </div>
          )}
          <p className="px-2 pt-2 text-xs text-[var(--dim)]">
            Tip: you don't need these menus — just ask {BRAND.short} in chat, in your own language.
            She can check the weather, read the news, make a picture, save a note, and open any tool for you.
          </p>
        </nav>

        <main className="min-w-0 grow px-3 py-4 pb-10 sm:px-5">
          {page === "dashboard" && <DashboardPage {...pageProps} />}
          {page === "chat" && <ChatPage {...pageProps} />}
          {page === "image" && <ImagePage {...pageProps} />}
          {page === "homework" && <HomeworkPage {...pageProps} />}
          {page === "youtube" && <YouTubePage {...pageProps} />}
          {page === "ocr" && <OcrPage {...pageProps} />}
          {page === "pdf" && <PdfChatPage {...pageProps} />}
          {page === "code" && <CodePage {...pageProps} />}
          {page === "python" && <PythonPage />}
          {page === "translate" && <TranslatePage {...pageProps} />}
          {page === "music" && <MusicPage />}
          {page === "prompts" && <PromptsPage {...pageProps} />}
          {page === "desktop" && <DesktopPage />}
          {page === "quiz" && <QuizPage {...pageProps} />}
          {page === "focus" && <FocusTimerPage />}
          {page === "notes" && <NotesPage {...pageProps} />}
          {page === "reminders" && <RemindersPage {...pageProps} />}
          {page === "dictionary" && <DictionaryPage {...pageProps} />}
          {page === "facts" && <FactsPage {...pageProps} />}
          {page === "qr" && <QrPage />}
          {page === "shortener" && <ShortenerPage {...pageProps} />}
          {page === "news" && <NewsPage {...pageProps} />}
          {page === "weather" && <WeatherPage {...pageProps} />}
          {page === "crypto" && <CryptoPage {...pageProps} />}
          {page === "cricket" && <CricketPage {...pageProps} />}
          {page === "games" && <GamesPage {...pageProps} />}
          {page === "leaderboard" && <LeaderboardPage {...pageProps} />}
          {page === "profile" && <ProfilePage {...pageProps} />}
          {page === "about" && <AboutPage />}
          {page === "feedback" && <FeedbackPage {...pageProps} />}
          {page === "install" && <InstallPage />}
          {page === "admin" && user.role === "admin" && <AdminPage {...pageProps} />}
          {page === "admin" && user.role !== "admin" && (
            <p className="panel px-4 py-3 text-sm">
              Admin area is restricted. Your role is verified on the server — this page isn't available to your account.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

// ------------------------------------------------------- verification gate
// Shown right after sign-up / sign-in until the account's email is
// verified. Local accounts verify with the 6-digit code (shown in-app —
// demo delivery, since no mail service is connected); Firebase accounts
// verify through Firebase's own email link.
function VerifyGate({
  token,
  user,
  onVerified,
  onSignOut,
}: {
  token: string | undefined;
  user: SessionUser;
  onVerified: () => void;
  onSignOut: () => void;
}) {
  const [code, setCode] = useState("");
  const [shownCode, setShownCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const isFirebase = user.authProvider === "firebase";

  const verify = useMutation({
    mutationFn: () => api.verifyEmail({ token, code: code.trim() }),
    onSuccess: onVerified,
    onError: (e) => setError(e instanceof Error ? e.message : "Verification failed."),
  });
  const resend = useMutation({
    mutationFn: () => api.resendVerifyCode({ token }),
    onSuccess: (d) => {
      setShownCode(d.verifyCode);
      setMsg("Here's your code — type it in the box and tap Verify.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not get a code."),
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
        throw new Error("No active Firebase session in this browser. Sign out and sign in again, then check.");
      }
      return api.refreshFirebaseVerification({ token, idToken });
    },
    onSuccess: (d) => {
      if (d.emailVerified) onVerified();
      else setError("Firebase still shows this email as unverified. Open the link in the verification email first.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Verification check failed."),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-8 text-[var(--text)]">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="reactor mx-auto" aria-hidden="true" />
          <h1 className="font-display neon-text mt-4 text-2xl tracking-widest">VERIFY YOUR EMAIL</h1>
          <p className="mt-2 text-sm text-[var(--dim)]">
            Hi {user.displayName} — one quick step before you start. Please verify{" "}
            <strong className="text-[var(--text)]">{user.email}</strong> so we know this account is really yours.
          </p>
          <p className="mt-1 text-xs text-[var(--dim)]">
            Verification message from {BRAND.creator}, creator of {BRAND.name}.
          </p>
        </div>
        <div className="panel mt-5 space-y-3 px-5 py-5">
          {msg && <p className="text-sm" style={{ color: "var(--good)" }}>{msg}</p>}
          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
          )}
          {isFirebase ? (
            <>
              <p className="text-sm text-[var(--dim)]">
                Firebase emailed you a verification link when you signed up. Open that link, then come back
                here and tap the check button.
              </p>
              <p className="text-xs text-[var(--dim)]">
                That email is sent for {BRAND.name} by its creator, {BRAND.creator} — the sender name shows
                the name set on the Firebase project.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost grow"
                  disabled={fbResend.isPending}
                  onClick={() => { setError(""); setMsg(""); fbResend.mutate(); }}
                >
                  Resend verification email
                </button>
                <button
                  type="button"
                  className="btn-primary grow"
                  disabled={fbCheck.isPending}
                  onClick={() => { setError(""); setMsg(""); fbCheck.mutate(); }}
                >
                  {fbCheck.isPending ? "Checking…" : "I've verified — check now"}
                </button>
              </div>
            </>
          ) : (
            <>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError("");
                  verify.mutate();
                }}
              >
                <label className="grow text-sm">
                  6-digit verification code
                  <input
                    aria-label="Email verification code"
                    className="input-dark"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter the code"
                    {...FIELDS.verifyEmail.code}
                  />
                </label>
                <button type="submit" className="btn-primary" disabled={verify.isPending || code.trim().length < 4}>
                  Verify
                </button>
              </form>
              <p className="text-sm text-[var(--dim)]">
                No mail service is connected yet, so your code is shown right here in the app instead of being
                emailed. Tap below to see it.
              </p>
              {shownCode ? (
                <p className="panel-raised px-3 py-2 text-center">
                  <span className="block text-xs text-[var(--dim)]">From: {BRAND.creator} · {BRAND.name}</span>
                  Your code: <strong className="neon-text text-lg tracking-widest">{shownCode}</strong>
                </p>
              ) : (
                <button
                  type="button"
                  className="btn-ghost w-full"
                  disabled={resend.isPending}
                  onClick={() => { setError(""); resend.mutate(); }}
                >
                  {resend.isPending ? "Getting your code…" : "Show my verification code"}
                </button>
              )}
            </>
          )}
          <button type="button" className="btn-ghost w-full" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Auth screen
function AuthScreen({
  reviews,
  maintenance,
  maintenanceMessage,
  firebaseEnabled,
  onAuthed,
}: {
  reviews: Array<{ id: number; displayName: string; stars: number; text: string }>;
  maintenance: boolean;
  maintenanceMessage: string;
  firebaseEnabled: boolean;
  onAuthed: (token: string) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifyInfo, setVerifyInfo] = useState("");

  const signIn = useMutation({
    mutationFn: () => api.signIn({ email: email.trim(), password }),
    onSuccess: (d) => onAuthed(d.token),
    onError: (e) => setError(e instanceof Error ? e.message : "Sign-in failed."),
  });
  const signUp = useMutation({
    mutationFn: () =>
      api.signUp({ displayName: displayName.trim(), email: email.trim(), password }),
    onSuccess: (d) => {
      setVerifyInfo(
        `Account created — welcome! Your email verification code is ${d.verifyCode}. You'll enter it on the very next screen to finish setting up your account.`,
      );
      onAuthed(d.token);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Sign-up failed."),
  });
  const fbIn = useMutation({
    mutationFn: async () => {
      const idToken = await fbSignIn(email.trim(), password);
      return api.firebaseSignIn({ idToken });
    },
    onSuccess: (d) => onAuthed(d.token),
    onError: (e) => setError(firebaseErrorMessage(e)),
  });
  const fbUp = useMutation({
    mutationFn: async () => {
      const idToken = await fbSignUp(email.trim(), password, displayName.trim());
      return api.firebaseSignIn({ idToken });
    },
    onSuccess: (d) => {
      setVerifyInfo(
        "Account created with Firebase Authentication. Firebase emailed you a verification link — open it, then confirm from your Profile page.",
      );
      onAuthed(d.token);
    },
    onError: (e) => setError(firebaseErrorMessage(e)),
  });
  const googleIn = useMutation({
    mutationFn: async () => {
      const idToken = await firebaseGoogleSignIn();
      return api.firebaseSignIn({ idToken });
    },
    onSuccess: (d) => onAuthed(d.token),
    onError: (e) => setError(firebaseErrorMessage(e)),
  });
  const [phone, setPhone] = useState("+91 ");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const phoneSend = useMutation({
    mutationFn: () => firebasePhoneSendOtp(phone.replace(/[\s-]/g, ""), "yukti-recaptcha"),
    onSuccess: () => {
      setOtpSent(true);
      setError("");
    },
    onError: (e) => setError(firebaseErrorMessage(e)),
  });
  const phoneConfirm = useMutation({
    mutationFn: async () => {
      const idToken = await firebasePhoneConfirmOtp(otp.trim());
      return api.firebaseSignIn({ idToken });
    },
    onSuccess: (d) => onAuthed(d.token),
    onError: (e) => setError(firebaseErrorMessage(e)),
  });
  const busy =
    signIn.isPending || signUp.isPending || fbIn.isPending || fbUp.isPending ||
    googleIn.isPending || phoneSend.isPending || phoneConfirm.isPending;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text)]">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <div className="reactor mx-auto" aria-hidden="true" />
          <h1 className="font-display neon-text mt-4 text-3xl tracking-widest">{BRAND.name}</h1>
          <p className="mt-1 text-sm text-[var(--dim)]">
            {BRAND.tagline} · by {BRAND.creator}
          </p>
        </div>

        {maintenance && (
          <p className="panel mt-5 px-4 py-3 text-center text-sm" style={{ color: "var(--warn)" }}>
            {maintenanceMessage}
          </p>
        )}
        {verifyInfo && (
          <p className="panel mt-5 px-4 py-3 text-sm" style={{ color: "var(--warn)" }}>
            {verifyInfo}
          </p>
        )}

        <p className="mt-5 text-center text-sm text-[var(--dim)]">
          {mode === "signin"
            ? "Welcome back! Sign in to continue."
            : "New here? Create a free account — it takes 10 seconds."}
        </p>

        <div className="panel mt-4 px-5 py-5">
          <div className="mb-4 flex gap-2" role="group" aria-label="Sign in or sign up">
            <button
              type="button"
              className={mode === "signin" ? "btn-primary grow" : "btn-ghost grow"}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "signup" ? "btn-primary grow" : "btn-ghost grow"}
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (firebaseEnabled) {
                if (mode === "signin") fbIn.mutate();
                else fbUp.mutate();
              } else if (mode === "signin") {
                signIn.mutate();
              } else {
                signUp.mutate();
              }
            }}
          >
            {mode === "signup" && (
              <label className="block text-sm">
                Your name
                <input
                  aria-label="Display name"
                  className="input-dark"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  {...FIELDS.signUp.displayName}
                />
              </label>
            )}
            <label className="block text-sm">
              Email
              <input
                aria-label="Email"
                className="input-dark"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                {...FIELDS.signUp.email}
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                aria-label="Password"
                type="password"
                className="input-dark"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...FIELDS.signUp.password}
              />
            </label>
            {mode === "signup" && (
              <p className="text-xs text-[var(--dim)]">Pick any password with at least 6 characters.</p>
            )}
            {error && (
              <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
            )}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={
                busy ||
                !email.trim() ||
                !password ||
                (mode === "signup" && displayName.trim().length < 2)
              }
            >
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
          {!firebaseEnabled && mode === "signup" && (
            <p className="mt-3 text-center text-xs text-[var(--dim)]">
              The first account created becomes the admin.
            </p>
          )}
        </div>

        {firebaseEnabled && (
          <div className="panel mt-4 space-y-4 px-5 py-5">
            <button
              type="button"
              className="btn-ghost w-full"
              disabled={busy}
              onClick={() => { setError(""); googleIn.mutate(); }}
            >
              {googleIn.isPending ? "Opening Google…" : "Continue with Google (Gmail)"}
            </button>
            <div className="flex items-center gap-3 text-xs text-[var(--dim)]" aria-hidden="true">
              <span className="h-px grow bg-[var(--border)]" />
              OR
              <span className="h-px grow bg-[var(--border)]" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Sign in with your mobile number</p>
              <label className="block text-sm">
                Mobile number (with country code)
                <input
                  aria-label="Mobile number with country code"
                  className="input-dark"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </label>
              {otpSent && (
                <label className="block text-sm">
                  OTP from the SMS
                  <input
                    aria-label="OTP from the SMS"
                    className="input-dark"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit OTP"
                  />
                </label>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost grow"
                  disabled={busy || phone.replace(/[^0-9]/g, "").length < 8}
                  onClick={() => { setError(""); phoneSend.mutate(); }}
                >
                  {phoneSend.isPending ? "Sending…" : otpSent ? "Resend OTP" : "Send OTP"}
                </button>
                {otpSent && (
                  <button
                    type="button"
                    className="btn-primary grow"
                    disabled={busy || otp.trim().length < 4}
                    onClick={() => { setError(""); phoneConfirm.mutate(); }}
                  >
                    {phoneConfirm.isPending ? "Verifying…" : "Verify & sign in"}
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--dim)]">
                Free on Firebase's plan — a 6-digit code arrives by SMS. The number itself is verified by the
                OTP, so no separate email verification is needed for phone accounts.
              </p>
              <div id="yukti-recaptcha" aria-hidden="true" />
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <section className="mt-6 space-y-3" aria-label="What users say">
            <h2 className="font-display text-center text-sm tracking-widest text-[var(--dim)]">
              WHAT USERS SAY
            </h2>
            {reviews.slice(0, 5).map((r) => (
              <blockquote key={r.id} className="panel px-4 py-3">
                <p style={{ color: "var(--warn)" }} aria-label={`${r.stars} out of 5 stars`}>
                  {"★".repeat(r.stars)}
                  <span className="text-[var(--dim)]">{"★".repeat(5 - r.stars)}</span>
                </p>
                <p className="mt-1 text-sm">“{r.text}”</p>
                <cite className="text-xs not-italic text-[var(--dim)]">— {r.displayName}</cite>
              </blockquote>
            ))}
          </section>
        )}

        <p className="mt-8 text-center text-xs text-[var(--dim)]">
          Created by <span className="text-[var(--text)]">{BRAND.creator}</span>
        </p>
      </div>
    </div>
  );
}
