// Firebase Authentication client helpers.
//
// The Firebase web config is NOT hardcoded anywhere: the server serves it
// from the owner's `firebase_config` setting (Admin → Firebase), and App
// passes it here via setFirebaseConfig. When no config exists, every helper
// reports "not configured" and the app uses its local demo auth instead.
// The Firebase SDK is loaded lazily (dynamic import) so local-mode users
// never download it.

import type { Auth, ConfirmationResult } from "firebase/auth";

let cachedConfig: Record<string, string> | null = null;
let authPromise: Promise<Auth> | null = null;
let phoneConfirmation: ConfirmationResult | null = null;

export function setFirebaseConfig(config: Record<string, string> | null) {
  const next = config && config.apiKey ? config : null;
  if (JSON.stringify(next) !== JSON.stringify(cachedConfig)) {
    cachedConfig = next;
    authPromise = null;
  }
}

export function firebaseConfigured(): boolean {
  return cachedConfig !== null;
}

async function getAuthLazy(): Promise<Auth> {
  if (!cachedConfig) throw new Error("Firebase is not configured yet.");
  if (!authPromise) {
    authPromise = (async () => {
      const { initializeApp } = await import("firebase/app");
      const { getAuth } = await import("firebase/auth");
      const app = initializeApp(cachedConfig as Record<string, string>);
      return getAuth(app);
    })();
  }
  return authPromise;
}

export function firebaseErrorMessage(e: unknown): string {
  const code =
    e && typeof e === "object" && "code" in e
      ? String((e as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/weak-password":
      return "That password is too weak — use at least 6 characters.";
    case "auth/invalid-email":
      return "That email address doesn't look valid.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a bit and try again.";
    case "auth/network-request-failed":
      return "Network problem reaching Firebase. Check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google sign-in window closed before finishing. Tap the Google button and try again.";
    case "auth/unauthorized-domain":
      return "This website's address isn't on Firebase's allowed list yet. The owner needs to add it in Firebase Console → Authentication → Settings → Authorized domains.";
    case "auth/operation-not-allowed":
      return "This sign-in method isn't switched on in Firebase yet. The owner needs to enable it in Firebase Console → Authentication → Sign-in method.";
    case "auth/invalid-phone-number":
      return "That phone number doesn't look right. Enter it with the country code, like +91 98765 43210.";
    case "auth/quota-exceeded":
      return "Too many OTPs were requested today — Firebase's free daily limit is reached. Please try again tomorrow.";
    case "auth/captcha-check-failed":
      return "The security check failed. Reload the page and try sending the OTP again.";
    case "auth/invalid-verification-code":
    case "auth/missing-verification-code":
      return "That OTP doesn't match. Check the SMS code and try again.";
    case "auth/code-expired":
      return "That OTP has expired. Send a fresh OTP and try again.";
    default:
      return e instanceof Error
        ? e.message
        : "Firebase sign-in failed. Please try again.";
  }
}

/** Creates the Firebase account, sets the display name, sends the Firebase
 * verification email, and returns the ID token for the server exchange. */
export async function firebaseSignUp(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  const auth = await getAuthLazy();
  const {
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
  } = await import("firebase/auth");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  try {
    await sendEmailVerification(cred.user);
  } catch {
    /* the user can resend from the Profile page */
  }
  return cred.user.getIdToken();
}

export async function firebaseSignIn(
  email: string,
  password: string,
): Promise<string> {
  const auth = await getAuthLazy();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.getIdToken();
}

export async function firebaseResendVerification(): Promise<boolean> {
  try {
    const auth = await getAuthLazy();
    if (!auth.currentUser) return false;
    const { sendEmailVerification } = await import("firebase/auth");
    await sendEmailVerification(auth.currentUser);
    return true;
  } catch {
    return false;
  }
}

export async function firebaseFreshIdToken(): Promise<string | null> {
  try {
    const auth = await getAuthLazy();
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken(true);
  } catch {
    return null;
  }
}

export async function firebaseSignOut(): Promise<void> {
  try {
    if (!cachedConfig) return;
    const auth = await getAuthLazy();
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  } catch {
    /* local sign-out proceeds regardless */
  }
}

/** "Continue with Google" — one tap, no password. Returns the ID token
 * for the server exchange (the server verifies it and applies the admin
 * allowlist, exactly like email sign-in). */
export async function firebaseGoogleSignIn(): Promise<string> {
  const auth = await getAuthLazy();
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user.getIdToken();
}

/** Phone sign-in (free on Firebase's Spark plan, with a daily OTP limit):
 * step 1 sends the SMS OTP. An invisible reCAPTCHA renders into the given
 * container element — Firebase requires it to stop OTP abuse. */
export async function firebasePhoneSendOtp(
  phoneE164: string,
  containerId: string,
): Promise<void> {
  const auth = await getAuthLazy();
  const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
  const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  phoneConfirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
}

/** Phone sign-in step 2: confirms the OTP and returns the ID token for
 * the server exchange. The server treats the OTP-verified number as a
 * verified account. */
export async function firebasePhoneConfirmOtp(code: string): Promise<string> {
  if (!phoneConfirmation) {
    throw new Error("Send the OTP first, then enter the code from the SMS.");
  }
  const cred = await phoneConfirmation.confirm(code);
  phoneConfirmation = null;
  return cred.user.getIdToken();
}
