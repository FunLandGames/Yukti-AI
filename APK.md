# Yukti AI — Android APK

Yukti AI can be installed on an Android phone as a real app (APK). The APK is
built automatically by GitHub — no Android Studio or coding tools are needed
on your computer or phone.

## How it works

Yukti AI's accounts, chat and AI tools run on its hosted server, so the APK is
a thin native shell (built with [Capacitor](https://capacitorjs.com)) that
opens the live app. Everything works exactly like the web version — sign-in,
chat, voice, quizzes, notes — the phone just needs an internet connection,
same as the website. The address it opens is set in `capacitor.config.ts`
(`server.url`); if the app ever moves to a new address, update that one line
and rebuild.

App identity: **Yukti AI**, package `com.lakshyapandey.yukti`.

## Get the APK (about 5 minutes)

1. **Push this project to GitHub** (branch `main`). The workflow in
   `.github/workflows/build-apk.yml` starts automatically on every push.
   You can also start it by hand: open the repo's **Actions** tab →
   **Build Android APK** → **Run workflow**.
2. Wait for the run to finish (green tick). It installs the project, builds
   the web app, syncs it into the Android project with Capacitor, and builds
   a debug APK with Gradle.
3. Open the finished run and scroll to **Artifacts**. Download
   **Yukti-AI-APK** (a zip containing `app-debug.apk`) and unzip it.
4. Send `app-debug.apk` to the phone (USB, WhatsApp, Google Drive — any way
   you like), tap it, and allow **Install unknown apps** for the app you
   opened it from when Android asks. Tap **Install**.

That's it — the Yukti AI icon appears in the app drawer like any other app.

## Notes

- This is a **debug APK**: perfect for your own phone and for sharing with
  friends/testers. Publishing on the Play Store would need a signed release
  build (a keystore + `assembleRelease`) — a later step, only if wanted.
- No API keys or secrets live in the repo or the APK: the app talks to its
  hosted server, and the server holds the secrets.
- To change what the APK opens, edit `server.url` in `capacitor.config.ts`,
  commit, and push — the next Actions run builds a fresh APK.
