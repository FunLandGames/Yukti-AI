// Capacitor configuration for the Yukti AI Android app.
//
// Yukti AI is server-backed: accounts, chat, quiz scoring and every AI tool
// run on the hosted server, so the APK is a native shell around the LIVE app
// (server.url below), not an offline copy. That keeps sign-in, chat and all
// tools working exactly like the web version — the phone only needs internet,
// like the web app itself. The bundled webDir is just the loading shell
// Capacitor requires; the real app is served from server.url.
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lakshyapandey.yukti",
  appName: "Yukti AI",
  webDir: "client/dist",
  server: {
    // This app's own hosted address (its Muse Space URL). If the app is
    // ever moved to a custom domain, change this one line and rebuild.
    url: "https://c2207205-bb37-4592-b67e-a774705a824d.spaces.muse.ai/",
    // The hosted app is HTTPS, so no cleartext (plain HTTP) traffic is needed.
    cleartext: false,
  },
};

export default config;
