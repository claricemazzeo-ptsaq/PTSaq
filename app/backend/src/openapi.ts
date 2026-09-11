/**
 * OpenAPI 3.0 spec for the actual routes in this backend — hand-written to
 * match `docs/API.md`, not generated, so keep them in sync when a route
 * changes. Served at GET /docs (Swagger UI) and GET /docs.json (raw spec)
 * by server.ts.
 */
const cookieAuth = { session: [] };

const errorSchema = {
  type: "object",
  properties: { error: { type: "string" }, details: { type: "object" } },
};

const taskSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "T1" },
    kind: { type: "string", enum: ["task"] },
    departmentId: { type: "string", example: "adm" },
    departmentShort: { type: "string" },
    frente: { type: "string" },
    title: { type: "string" },
    owner: { type: "string" },
    status: { type: "string", enum: ["Não iniciado", "Em execução", "Executado", "Justificada"] },
    dueDate: { type: "string", format: "date-time", nullable: true },
    dueDays: { type: "integer", nullable: true },
    budgetCents: { type: "integer", nullable: true, description: "null = não informado, never inferred" },
    note: { type: "string", nullable: true },
    contested: { type: "boolean" },
    conflictSheetStatus: { type: "string", nullable: true },
    conflictAt: { type: "string", format: "date-time", nullable: true },
    goalId: { type: "string", nullable: true },
    sheetCell: { type: "string", nullable: true },
    blockedByTaskId: { type: "string", nullable: true },
    canEdit: { type: "boolean" },
    readOnlyReason: { type: "string", nullable: true },
  },
};

const goalSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "2.4" },
    kind: { type: "string", enum: ["goal"] },
    departmentId: { type: "string" },
    departmentShort: { type: "string" },
    title: { type: "string" },
    owner: { type: "string" },
    schedule: { type: "string", nullable: true },
    status: { type: "string", enum: ["A iniciar", "Em andamento", "Concluída", "Justificada"] },
    pct: { type: "integer" },
    dueDate: { type: "string", format: "date-time", nullable: true },
    flag: { type: "string", nullable: true },
    note: { type: "string", nullable: true },
    sheetCell: { type: "string", nullable: true },
    canEdit: { type: "boolean" },
    readOnlyReason: { type: "string", nullable: true },
  },
};

const documentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    driveFileId: { type: "string", nullable: true },
    departmentId: { type: "string", nullable: true },
    type: { type: "string", enum: ["PDF", "DOCX", "XLSX", "SVG", "PNG"] },
    title: { type: "string" },
    version: { type: "string", nullable: true },
    sizeBytes: { type: "integer", nullable: true },
    status: { type: "string", enum: ["Aprovado", "Em revisão", "Aguardando assinatura"] },
    note: { type: "string", nullable: true },
    driveUpdatedAt: { type: "string", format: "date-time", nullable: true },
    linkedTaskIds: { type: "array", items: { type: "string" } },
    linkedGoalIds: { type: "array", items: { type: "string" } },
    pinned: { type: "boolean" },
  },
};

const userSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
    role: { type: "string", enum: ["admin", "lead", "contrib"] },
    title: { type: "string", nullable: true },
    departmentId: { type: "string", nullable: true },
    status: { type: "string", enum: ["pending", "active", "suspended"] },
    availability: { type: "string", enum: ["office", "field", "focus"] },
    notifyPush: { type: "boolean" },
    offlineCacheMb: { type: "integer" },
  },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "PTSaq — Hub de Operações API",
    version: "0.1.0",
    description:
      "Backend for the Parque Tecnológico de Saquarema operations hub. Every authenticated route requires the `ptsaq_session` httpOnly cookie — there is no bearer-token mode. See docs/API.md and docs/SECURITY.md in the repo for the full write-up this spec mirrors.",
  },
  servers: [{ url: "/", description: "Same origin this doc is served from" }],
  components: {
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: "ptsaq_session", description: "Set by /auth/login, /auth/register (post-approval), or /auth/google/callback." },
      webhookSecret: { type: "apiKey", in: "header", name: "X-PTSaq-Webhook-Secret" },
    },
    schemas: { Task: taskSchema, Goal: goalSchema, Document: documentSchema, User: userSchema, Error: errorSchema },
    responses: {
      Unauthorized: { description: "Not authenticated, or access token expired (call POST /auth/refresh)", content: { "application/json": { schema: errorSchema } } },
      Forbidden: { description: "Authenticated but not entitled to this row/action (RBAC)", content: { "application/json": { schema: errorSchema } } },
      NotFound: { description: "No such row", content: { "application/json": { schema: errorSchema } } },
    },
  },
  tags: [
    { name: "Auth" },
    { name: "Me" },
    { name: "Departments" },
    { name: "Tasks" },
    { name: "Goals" },
    { name: "Documents" },
    { name: "Notifications" },
    { name: "Activity" },
    { name: "Sync" },
    { name: "Admin" },
    { name: "Webhooks" },
  ],
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create a pending account (rate-limited)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "email", "password", "departmentId"], properties: { name: { type: "string" }, email: { type: "string" }, password: { type: "string", minLength: 10 }, departmentId: { type: "string", enum: ["com", "jur", "tec", "adm"] } } } } } },
        responses: { "201": { description: "Pending", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" } } } } } }, "400": { content: { "application/json": { schema: errorSchema } } }, "409": { description: "Email already registered" } },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Email/password login (rate-limited: 20 attempts / 15 min per IP+email)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } } } } },
        responses: { "200": { description: "Sets ptsaq_session (15 min) + ptsaq_refresh (30 days) cookies", content: { "application/json": { schema: { type: "object", properties: { user: userSchema } } } } }, "401": { description: "Invalid credentials" }, "403": { description: "account_pending or account_suspended" } },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate the refresh token, reissue both cookies",
        description: "A reused (already-rotated) refresh token revokes the entire chain for that user — signals theft.",
        responses: { "200": { description: "New cookie pair set" }, "401": { description: "no_refresh_token | refresh_token_invalid | refresh_token_reused" } },
      },
    },
    "/auth/logout": { post: { tags: ["Auth"], summary: "Revoke the current refresh token, clear both cookies", responses: { "200": { description: "OK" } } } },
    "/auth/google": { get: { tags: ["Auth"], summary: "Redirect to Google's OAuth consent screen", responses: { "302": { description: "Redirect" }, "501": { description: "Google OAuth not configured" } } } },
    "/auth/google/callback": { get: { tags: ["Auth"], summary: "OAuth callback — exchanges the code, creates/links the user, redirects to the frontend", responses: { "302": { description: "Redirect" } } } },

    "/me": {
      get: { tags: ["Me"], summary: "Current user + department", security: [cookieAuth], responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { user: userSchema, department: { type: "object", nullable: true } } } } } }, "401": { $ref: "#/components/responses/Unauthorized" } } },
      patch: { tags: ["Me"], summary: "Update availability / notification prefs", security: [cookieAuth], requestBody: { content: { "application/json": { schema: { type: "object", properties: { availability: { type: "string", enum: ["office", "field", "focus"] }, notifyPush: { type: "boolean" }, offlineCacheMb: { type: "integer" } } } } } }, responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { user: userSchema } } } } } } },
    },

    "/departments": { get: { tags: ["Departments"], summary: "All 4 departments with computed goalProgressPct", security: [cookieAuth], responses: { "200": { content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } } } } },

    "/tasks": { get: { tags: ["Tasks"], summary: "List tasks", security: [cookieAuth], parameters: [{ name: "department", in: "query", schema: { type: "string" } }, { name: "mine", in: "query", schema: { type: "string", enum: ["true"] } }], responses: { "200": { content: { "application/json": { schema: { type: "array", items: taskSchema } } } } } } },
    "/tasks/{id}": {
      get: { tags: ["Tasks"], summary: "Get one task (includes readOnlyReason when not editable)", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { content: { "application/json": { schema: taskSchema } } }, "404": { $ref: "#/components/responses/NotFound" } } },
      patch: {
        tags: ["Tasks"],
        summary: "Update status/note",
        description: "403 if not editable (RBAC). 409 conflict_pending if the row is `contested` — resolve it first via POST /tasks/{id}/resolve-conflict. Triggers: audit entry, activity feed, SyncQueueItem, Sheets write-back, dependency-unlock check when status → Executado.",
        security: [cookieAuth],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["Não iniciado", "Em execução", "Executado"] }, note: { type: "string", nullable: true } } } } } },
        responses: { "200": { content: { "application/json": { schema: taskSchema } } }, "403": { $ref: "#/components/responses/Forbidden" }, "409": { description: "conflict_pending" } },
      },
    },

    "/goals": { get: { tags: ["Goals"], summary: "List goals", security: [cookieAuth], parameters: [{ name: "department", in: "query", schema: { type: "string" } }], responses: { "200": { content: { "application/json": { schema: { type: "array", items: goalSchema } } } } } } },
    "/goals/{id}": {
      get: { tags: ["Goals"], summary: "Get one goal", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { content: { "application/json": { schema: goalSchema } } }, "404": { $ref: "#/components/responses/NotFound" } } },
      patch: {
        tags: ["Goals"],
        summary: "Update status/note",
        security: [cookieAuth],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["A iniciar", "Em andamento", "Concluída", "Justificada"] }, note: { type: "string", nullable: true } } } } } },
        responses: { "200": { content: { "application/json": { schema: goalSchema } } }, "403": { $ref: "#/components/responses/Forbidden" } },
      },
    },
    "/goals/{id}/audit": { get: { tags: ["Goals"], summary: "Audit trail for a goal", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } } } } },

    "/tasks/{id}/audit": { get: { tags: ["Tasks"], summary: "Audit trail for a task", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } } } } },
    "/tasks/{id}/resolve-conflict": { post: { tags: ["Tasks"], summary: "Resolve a pending edit conflict", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["keep"], properties: { keep: { type: "string", enum: ["mine", "sheet"] } } } } } }, responses: { "200": { content: { "application/json": { schema: taskSchema } } }, "400": { description: "no_conflict_pending" } } } },
    "/tasks/{id}/dependency": {
      post: { tags: ["Tasks"], summary: "Link a blocking task", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["blockedByTaskId"], properties: { blockedByTaskId: { type: "string" } } } } } }, responses: { "200": { description: "OK" } } },
      delete: { tags: ["Tasks"], summary: "Clear the dependency link", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
    },

    "/documents": { get: { tags: ["Documents"], summary: "List documents", security: [cookieAuth], parameters: [{ name: "scope", in: "query", schema: { type: "string" }, description: "department id, 'glo' for Global, omit for all" }, { name: "type", in: "query", schema: { type: "string" } }, { name: "q", in: "query", schema: { type: "string" } }], responses: { "200": { content: { "application/json": { schema: { type: "array", items: documentSchema } } } } } } },
    "/documents/{id}": { get: { tags: ["Documents"], summary: "Get one document", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { content: { "application/json": { schema: documentSchema } } } } } },
    "/documents/{id}/pin": {
      post: { tags: ["Documents"], summary: "Pin for offline", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
      delete: { tags: ["Documents"], summary: "Unpin", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
    },
    "/documents/refresh": { post: { tags: ["Documents"], summary: "Metadata-only Drive poll (no-op in mock mode)", security: [cookieAuth], responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, mock: { type: "boolean" }, matched: { type: "integer" } } } } } } } } },

    "/notifications": { get: { tags: ["Notifications"], summary: "List my notifications", security: [cookieAuth], responses: { "200": { content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } } } } },
    "/notifications/{id}/read": { post: { tags: ["Notifications"], summary: "Mark one read", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } } },
    "/notifications/read-all": { post: { tags: ["Notifications"], summary: "Mark all read", security: [cookieAuth], responses: { "200": { description: "OK" } } } },

    "/activity": { get: { tags: ["Activity"], summary: "Dashboard activity feed (last 12)", security: [cookieAuth], parameters: [{ name: "mine", in: "query", schema: { type: "string", enum: ["true"] } }], responses: { "200": { content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } } } } },

    "/sync/status": { get: { tags: ["Sync"], summary: "Live/mock mode, connected sheets, and this user's pending write queue", security: [cookieAuth], responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { live: { type: "boolean" }, queue: { type: "array", items: { type: "object" } }, sheets: { type: "array", items: { type: "object" } } } } } } } } } },
    "/sync/now": { post: { tags: ["Sync"], summary: "Trigger a full resync cycle (broadcasts sync:status over the socket)", security: [cookieAuth], responses: { "200": { description: "OK" } } } },

    "/admin/pending-accounts": { get: { tags: ["Admin"], summary: "Accounts awaiting approval (role: admin)", security: [cookieAuth], responses: { "200": { content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } }, "403": { $ref: "#/components/responses/Forbidden" } } } },
    "/admin/pending-accounts/{id}/approve": { post: { tags: ["Admin"], summary: "Approve an account (role: admin)", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" }, "403": { $ref: "#/components/responses/Forbidden" } } } },
    "/admin/pending-accounts/{id}/reject": { post: { tags: ["Admin"], summary: "Reject an account (role: admin)", security: [cookieAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" }, "403": { $ref: "#/components/responses/Forbidden" } } } },

    "/webhooks/sheets": {
      post: {
        tags: ["Webhooks"],
        summary: "Apps Script onEdit push — see GoogleAppsScript.gs",
        security: [{ webhookSecret: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["spreadsheet_id", "sheet_name", "row_index", "data"],
                properties: {
                  spreadsheet_id: { type: "string" },
                  sheet_name: { type: "string", example: "Painel Operacional" },
                  row_index: { type: "integer", example: 4 },
                  data: {
                    type: "object",
                    properties: {
                      id_tarefa: { type: "string", description: "Preferred — direct lookup by primary key. Falls back to sheet_name+row_index matching against stored sheetCell if omitted.", example: "T1" },
                      status: { type: "string", description: "Unrecognized values are logged and skipped, never crash the request (ETL tolerance)." },
                      observacao: { type: "string" },
                    },
                  },
                },
              },
              example: { spreadsheet_id: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms", sheet_name: "Painel Operacional", row_index: 4, data: { id_tarefa: "T1", status: "Em execução", observacao: "…" } },
            },
          },
        },
        responses: {
          "200": { description: "Applied (or matched with nothing to apply)", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, matched: { type: "string", enum: ["task", "goal"] }, id: { type: "string" }, applied: { type: "boolean" } } } } } },
          "401": { description: "invalid_webhook_secret" },
          "404": { description: "no_matching_row" },
          "501": { description: "webhook_not_configured — SHEETS_WEBHOOK_SECRET unset" },
        },
      },
    },
  },
};
