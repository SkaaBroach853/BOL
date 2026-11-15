# BOL architecture

## Data flow and authority

React + TypeScript + Vite → same-origin Express / Node + TypeScript → file-backed SQLite. Production serves `dist/` and the API in one process. Development mounts Vite middleware in that same process. `server/ledger.ts` owns every financial rule; the frontend and language model cannot submit arbitrary confirmed fields or SQL.

Manual fields → strict Zod action schema → canonical proposal stored in SQLite → visual review → explicit confirmation with proposal ID + client operation ID → revalidation inside `BEGIN IMMEDIATE` → ledger entries + operation receipt + proposal state commit atomically.

Voice: deliberate permission request → MediaRecorder → stop/20-second cap → transient audio upload → real configurable OpenAI transcription adapter → editable visible text → strict structured intent → deterministic identity/money resolution → clarification or server proposal → the same confirmation boundary. No model-directed database writes, code, tools, or external links. Context is limited to the last seen eligible ledger event; a stale last-action ID is rejected. Unknown names never create customers automatically.

Absent credentials: microphone shows setup requirements. Typed input alone uses disclosed local rules. It cannot stand in for audio verification. There is no application fixture mode or simulated financial activity.

## Storage

`shops`, `customers`, `proposals`, `operations`, `ledger_entries`, and a `meta` active-shop pointer. UUID customer identities survive repeat names. Customer histories are indexed. Ledger entries have positive `amount`, signed `delta`, explicit CREDIT/REPAYMENT/REVERSAL type, operation ID and original-entry linkage. Relevant foreign keys are enabled. Ledger UPDATE/DELETE triggers refuse mutation. Snapshots read customers and history in one SQLite transaction.

SQLite WAL, foreign keys, FULL synchronous mode and a five-second busy timeout are enabled. A narrow synchronous wrapper uses the SQLite binding maintained in Node. The original native-library install failed on this host; Node's bundled binding removes the C++ compiler dependency. Node 22.17 emits its experimental-API warning. This is a deliberate portability tradeoff; SQLite remains the authoritative persistent database.

Version-one schema is created at startup idempotently. There is no schema-upgrade engine beyond this initial schema; future incompatible changes require explicit migrations. Test databases are separate from the demonstration database.

## Money and correction invariants

Rupee strings match digits plus at most two decimal places. Whole rupees and the padded fractional string become paise independently; no floating-point currency arithmetic. Reject zero, negatives, exponent notation, precision errors and values above the configurable ₹10,000 entry limit. Formatting divides paise only for display. Outstanding is the sum of ledger deltas, never a mutable balance field or model claim. Repayment cannot exceed outstanding, including at final confirmation.

Correction targets capture the latest entry's ID and sequence version. Revalidate current head, type, reversal status and balance within the write transaction. Moving credit appends REVERSAL(original) plus CREDIT(replacement), with both entries linked to the original. Reversing repayment appends a positive reversal. A unique partial index prevents two reversals of one original. Only the latest event can be targeted, so later repayments also make an earlier credit ineligible. A failed second insert rolls back the first reversal. Corrections are intentionally narrow rather than a general historical edit system.

Proposals contain canonical fields, state and expiry, and default to five minutes. Cancellation closes a pending proposal. Repeated confirmation with a different operation fails after closure. Identical operation retries are checked first and return their persisted receipt even after proposal expiry. Operation identity includes the proposal ID, so reusing it with another preview fails. The model and client cannot replace canonical payload fields during confirmation.

## Recovery and concurrency

The browser persists `{shopId,proposalId,operationId}` before sending financial confirmation; it refuses to send when local storage fails. Unknown outcomes keep that ID for retry and GET receipt lookup. Refresh checks the operation endpoint. Pending drafts never affect totals. Customer creation has its own persisted operation ID and server idempotency.

SQLite serializes financial writes. Eight concurrent HTTP retries are tested for one economic effect and identical receipt IDs. This is a single local process and shop, not a multi-user synchronization product. Input requests use abort controllers and monotonically increasing generations; old/cancelled responses cannot activate new previews. Aborting interpretation can at most leave an unused expiring proposal; interpretation never moves money. Media tracks and timers are stopped on stop/cancel/unmount, and late permission grants are immediately stopped.

Guarded demo reset creates a new shop and updates the active pointer in one transaction. It never deletes the archived ledger. Other browser tabs need refresh after reset; this prototype does not browse archives or recover archived-shop requests through the active-shop API.

## Security and privacy boundary

Loopback-only binding and localhost host checks protect the local-demo scope. Mutations require a session CSRF token and same origin. There is no wildcard CORS. JSON is capped at 16 KiB; recordings at 5 MiB; provider endpoints at 30 requests/minute and other mutations at 120/minute per local IP bucket. The UI caps recording at 20 seconds. The server checks supported audio MIME and basic container signatures; it does not fully decode hostile media. HTTPS or localhost is needed for browser recording. Provider requests have a configurable 30-second timeout and sanitized public errors. Server logs contain error classes/codes, not keys, transcripts or payloads.

Audio is held in browser/server request memory and discarded after processing, never deliberately saved. The visible transcript is kept in browser component memory, not SQLite. Canonical proposals and receipts are persisted. Manual drafts, pending confirmation IDs and customer-create retry information use browser local storage. There is no continuous listening or voice readback.

Cloud provider: audio goes to OpenAI's transcription endpoint; transcripts and limited previous-action context go to Responses. We request `store:false` for Responses. As documented on 2026-11-15, OpenAI's endpoint table lists no transcription application-state/abuse retention and lists Responses abuse monitoring generally at 30 days, with policy exceptions/account controls. BOL cannot enforce provider-side retention or promise all-local/private AI. Read the account's applicable terms before real data. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## Network and deployment

Local server reachable, internet unavailable: loaded manual UI and SQLite may continue; cloud tasks fail visibly. Server unavailable: loaded last records are retained, disconnected status appears, no financial write is represented as saved. Operation lookup handles uncertain outcomes. No service worker / offline reload / sync queue is claimed.

No deployment is made. A future hosted version needs TLS, authenticated protected sessions, per-user isolated demo shops, persistent disk/backups or a deliberate database migration, stricter production CSP and operational monitoring. Do not put this SQLite file on ephemeral/serverless disk or expose the loopback demo through an unprotected tunnel.

## Primary implementation references

- [Node 22.17 SQLite API](https://github.com/nodejs/node/blob/v22.17.0/doc/api/sqlite.md)
- [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Vite setup/runtime requirements](https://vite.dev/guide/)

These references informed implementation. They do not verify this account's model access or a live provider request.
