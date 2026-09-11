import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} — copy .env.example to .env and fill it in.`);
  return v;
}

const webOriginList = (process.env.WEB_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Fixed by the platform, not per-deployment — a Capacitor app's WebView
// always requests from one of these, regardless of which real backend
// it's pointed at, so there's nothing to configure per environment.
export const MOBILE_APP_ORIGINS = ["capacitor://localhost", "http://localhost", "https://localhost"];

export const env = {
  port: Number(process.env.PORT || 4000),
  // Single canonical origin — used for OAuth redirect targets, which only
  // make sense pointing at one destination even when several origins
  // (web install, Capacitor apps) are allowed to call the API.
  webOrigin: webOriginList[0],
  // Full allow-list for CORS/cookie origin checks (comma-separated in
  // WEB_ORIGIN) — the web app and native apps never share one origin.
  webOrigins: webOriginList,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),

  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
    allowedDomain: process.env.GOOGLE_OAUTH_ALLOWED_DOMAIN || "",
    get enabled() {
      return !!(this.clientId && this.clientSecret);
    },
  },

  sheets: {
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "",
    painelSheetId: process.env.SHEET_ID_PAINEL_OPERACIONAL || "",
    planoSheetId: process.env.SHEET_ID_PLANO_DE_TRABALHO || "",
    driveFolderId: process.env.DRIVE_FOLDER_ID || "1rtRecy4IjFejSXOG7UHsVEYm-4h7QoBM",
    get enabled() {
      return !!(this.serviceAccountJson && this.painelSheetId && this.planoSheetId);
    },
  },

  // Shared secret an Apps Script onEdit trigger sends back on every
  // webhook call (see routes/webhooks.ts) — not a Google credential, just
  // a password the script and this server both know. Unset = the
  // endpoint refuses everything with 501, so it's inert until configured.
  webhookSecret: process.env.SHEETS_WEBHOOK_SECRET || "",
};
