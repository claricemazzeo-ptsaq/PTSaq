import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi.js";
import { env, MOBILE_APP_ORIGINS } from "./env.js";
import { attachUser } from "./auth/middleware.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { departmentsRouter } from "./routes/departments.js";
import { tasksRouter } from "./routes/tasks.js";
import { goalsRouter } from "./routes/goals.js";
import { documentsRouter } from "./routes/documents.js";
import { notificationsRouter } from "./routes/notifications.js";
import { adminRouter } from "./routes/admin.js";
import { syncRouter } from "./routes/sync.js";
import { activityRouter } from "./routes/activity.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { initRealtime } from "./realtime/socket.js";
import { startBackgroundSync } from "./services/googleSync.js";

const app = express();
// This is a pure JSON API consumed only by the separate frontend origin —
// no HTML is ever rendered here, so a strict default-src 'none' CSP is
// correct (and harmless) rather than the browsing-page-oriented defaults.
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } } }));
app.use(cors({ origin: [...env.webOrigins, ...MOBILE_APP_ORIGINS], credentials: true }));
app.use(apiLimiter);
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.get("/health", (_req, res) => res.json({ ok: true, liveSync: env.sheets.enabled, googleOAuth: env.google.enabled }));

// Swagger UI needs to load its own inline scripts/styles, which the strict
// API-wide CSP above (default-src 'none') would otherwise block — dropped
// only for this one path, before it reaches swagger-ui-express's handler.
app.use(
  "/docs",
  (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.removeHeader("Content-Security-Policy");
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, { customSiteTitle: "PTSaq API" }),
);
app.get("/docs.json", (_req, res) => res.json(openApiSpec));

app.use("/auth", authRouter);
app.use("/webhooks", webhooksRouter);
app.use("/me", meRouter);
app.use("/departments", departmentsRouter);
app.use("/tasks", tasksRouter);
app.use("/goals", goalsRouter);
app.use("/documents", documentsRouter);
app.use("/notifications", notificationsRouter);
app.use("/admin", adminRouter);
app.use("/sync", syncRouter);
app.use("/activity", activityRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

const server = http.createServer(app);
initRealtime(server);
startBackgroundSync();

server.listen(env.port, () => {
  console.log(`[ptsaq-backend] listening on :${env.port} — live Sheets sync: ${env.sheets.enabled ? "ON" : "OFF (mock mode)"}, Google OAuth: ${env.google.enabled ? "ON" : "OFF (email/password only)"}`);
});
