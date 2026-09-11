import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Wraps the same React/Vite build (dist/) already shipped as a PWA into
 * real iOS and Android app shells — no separate mobile codebase. See
 * README "Apps nativos (iOS / Android)" for the build steps.
 *
 * appId follows Apple/Google's reverse-DNS convention — this one is a
 * placeholder; change it to match whatever Apple Developer / Google Play
 * Console account will actually publish the app, since it can't be
 * changed after the first store submission without becoming a new app.
 */
const config: CapacitorConfig = {
  appId: "br.gov.rj.saquarema.ptsaq",
  appName: "PTSaq",
  webDir: "dist",
  backgroundColor: "#FFF9E7", // Branco Praia — matches the PWA manifest's splash background
  ios: {
    contentInset: "always",
  },
  server: {
    // Capacitor 8 already defaults Android to https://localhost (iOS is
    // always capacitor://localhost) — stated explicitly here because the
    // backend's Secure cookies (see auth/tokens.ts) depend on it: an http
    // WebView origin would silently drop every Set-Cookie from the API.
    androidScheme: "https",
  },
};

export default config;
