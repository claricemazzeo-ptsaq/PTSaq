# PTSaq — Database Schema

Source of truth is `backend/prisma/schema.prisma` — this is a reading aid
for it, not a separate spec. PostgreSQL, via Prisma.

```mermaid
erDiagram
    Department ||--o{ User : "has members"
    Department ||--o{ Task : "owns"
    Department ||--o{ Goal : "owns"
    Department ||--o{ Document : "scopes (null = Global)"

    User ||--o{ Task : "owns (free-text ownerName is the real match; ownerId is best-effort)"
    User ||--o{ Goal : owns
    User ||--o{ RefreshToken : has
    User ||--o{ AuditEntry : authored
    User ||--o{ Notification : receives
    User ||--o{ ActivityEntry : authored
    User ||--o{ PinnedDocument : pinned
    User ||--o{ SyncQueueItem : queued

    Task ||--o{ Task : "blockedByTask (self, dependency)"
    Task ||--o{ DocumentLink : linked
    Task ||--o{ AuditEntry : has
    Task ||--o{ Notification : triggers

    Goal ||--o{ DocumentLink : linked
    Goal ||--o{ AuditEntry : has

    Document ||--o{ DocumentLink : linked
    Document ||--o{ PinnedDocument : pinned
    Document ||--o{ Notification : triggers

    Department {
        string id PK "com | jur | tec | adm"
        string short
        string name
    }
    User {
        string id PK
        string name
        string email UK
        string passwordHash "null = Google-OAuth-only"
        string googleSub UK
        Role role "admin | lead | contrib"
        string departmentId FK
        AccountStatus status "pending | active | suspended"
        AvailabilityStatus availability
        boolean notifyPush
    }
    RefreshToken {
        string id PK
        string userId FK
        string tokenHash UK "sha256 of the opaque token — never stores it raw"
        datetime expiresAt
        datetime revokedAt "reuse of a revoked token nukes the whole chain"
    }
    Task {
        string id PK "T1..T24 — the real Painel Operacional row key"
        string departmentId FK
        string ownerName "free text, RBAC's real match key"
        string ownerId FK "best-effort link to users.id"
        TaskStatus status "nao_iniciado | em_execucao | executado | justificada"
        int budgetCents "null = not informed, never inferred"
        boolean contested
        TaskStatus conflictSheetStatus "set only while contested"
        string goalId "soft link into Plano de Trabalho, e.g. 2.4"
        string sheetCell "provenance + live-write target"
        string blockedByTaskId FK "self-relation — the dependency graph"
    }
    Goal {
        string id PK "1.1, 2.4, 3.1.2 — the real Plano de Trabalho row key"
        string departmentId FK
        GoalStatus status "a_iniciar | em_andamento | concluida | justificada"
        string flag "data-quality note instead of a guessed value"
        string sheetCell "best-effort at seed time — re-resolved by title at write time"
    }
    Document {
        string id PK
        string driveFileId UK "null until live Drive sync matches it"
        string departmentId FK "null = Global scope"
        string type "PDF | DOCX | XLSX | SVG | PNG"
        DocumentStatus status "aprovado | em_revisao | aguardando_assinatura"
    }
    DocumentLink {
        string id PK
        string documentId FK
        string taskId FK "nullable"
        string goalId FK "nullable — exactly one of taskId/goalId is set"
    }
    PinnedDocument {
        string id PK
        string userId FK
        string documentId FK
    }
    AuditEntry {
        string id PK
        string taskId FK "nullable"
        string goalId FK "nullable"
        string userId FK "null for Sheets-originated edits"
        SyncOrigin origin "app | google_sheets"
        string summary
    }
    Notification {
        string id PK
        NotificationKind kind "bloqueio | dependencia_liberada | prazo | documento"
        string tone "alert | good | neutral"
        string userId FK
        datetime readAt
    }
    ActivityEntry {
        string id PK
        string userId FK
        string summary
    }
    SyncQueueItem {
        string id PK
        string userId FK
        string state "na fila | enviando | erro"
    }
```

## Notes that matter more than the diagram

- **`Task.id` / `Goal.id` are real, human-legible keys** (`T1`, `2.4`),
  not surrogate UUIDs — they're literally the identifiers used in the
  source spreadsheets during the design handoff. This is a deliberate
  departure from "always use a UUID surrogate key": these ids are the
  domain's actual stable identity, and preserving them keeps `sheetCell`
  provenance, dependency links (`blockedByTaskId`), and the frontend's
  `?open=task:T9` deep-linking all trivially readable.
- **RBAC's real authority is `ownerName` (free text), not `ownerId`.**
  `ownerId` is a best-effort link resolved at seed time by matching first
  names; `auth/rbac.ts canEditRow()` checks `ownerName.includes(firstName)`
  directly, because that's what the source data actually guarantees.
  Don't "clean this up" into a hard foreign-key-only check without first
  confirming every row's owner text resolves to a real account.
- **No generic `metadata JSONB` column anywhere.** Every field the app
  reads or writes has a real, typed column. A JSONB catch-all is the
  right call when the shape is genuinely unknown or externally owned;
  here it's fully known (it's two specific spreadsheets), so a loose blob
  would just be the schema declining to enforce what it already knows.
- **`PendingAccountRequest` duplicates a `User` row on purpose** — a
  `pending` `User` already exists at registration time (so RBAC has
  someone to check against the moment they're approved), and the request
  table is the admin-facing queue. Approving one flips both records to
  `active` in a single transaction (`routes/admin.ts`).
