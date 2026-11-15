# BOL — Codex master handoff

## 1. Mission and execution instructions

Build BOL, a trustworthy Hindi/English voice ledger for a small tea-stall owner, for VibeX Codes Track 1. Deliver an actual working application, not a landing page, chatbot, or simulated dashboard. The core promise is: speak a credit entry, check what was understood, correct mistakes, and track repayments safely.

Read this entire document before implementing. Inspect the current repository and its instructions first. Reuse an existing compatible stack; do not overwrite unrelated work. If starting empty, use the default stack below. Make routine implementation decisions autonomously. Implement in milestones, verify each milestone, and continue until the demo is usable. Do not stop after planning or generating UI mockups. Never claim a feature, test, deployment, or integration works without observing it.

This is a hackathon prototype with a narrow, reliable scope. No claim of guaranteed victory, perfect recognition, production readiness, or invention of voice bookkeeping. The distinction is safe correction, clarification, and reliable transactions.

## 2. Target user and essential experience

A tea-stall owner with busy hands needs to record customer credit without typing English. Hindi and mixed Hindi/English are the initial supported input languages. Do not claim regional-language or dialect coverage without testing it.

The first screen must make the next action obvious within 10 seconds: a large microphone button, a manual-entry alternative, and recent entries. Three main destinations: Home, Customers, Activity. Settings should be secondary. A desktop presentation layout may show the ledger beside the voice panel; mobile remains the primary experience.

Essential journey:
1. Owner speaks: "Ramesh ke naam chalis rupaye udhaar likho."
2. App shows the transcript and a transaction preview: Ramesh, credit added, Rs 40.
3. Owner confirms; only then does the database change.
4. Owner says: "Nahi, Ramesh nahi, Suresh."
5. App previews moving the last eligible credit to Suresh. Confirmation creates an auditable correction, preserving the original history.
6. Owner says: "Suresh ne bees rupaye de diye."
7. Confirmed repayment leaves Rs 20 outstanding.

In the MVP all monetary changes require one explicit tap or accessible keyboard confirmation. Voice confirmation is stretch work. Never execute a financial action from transcription alone. Readback is helpful but must not substitute for a visual receipt.

## 3. Scope and priorities

### P0: complete before adding polish or extras
- Seeded sample shop with clearly marked demo customers and zero opening balances.
- Add customer, optional distinguishing label, and stable customer ID.
- Add credit and record repayment using manual entry.
- Hindi/English audio recording, real transcription, and structured intent parsing when credentials are configured.
- Resolve customers; ask for missing amount or ambiguous customer.
- Preview, confirm, cancel, and visible pending/saved/failed states.
- Persistent ledger, derived balances, transaction receipts, activity history.
- Correct/reverse the last eligible transaction with an explicit preview.
- Duplicate-request protection and stale-correction handling.
- Refresh persistence, usable local demo, keyboard-accessible controls.
- Honest offline/manual fallback and provider error handling.

### P1: only after the full P0 workflow passes
- Browser speech readback where a suitable voice is available; do not promise Hindi voices exist on every device.
- Downloadable CSV with proper escaping and spreadsheet-formula injection mitigation.
- Installable app shell and offline read-only ledger view, with manual writes as specified below.
- Recorded-audio upload for repeatable real-provider testing.
- Small performance/usage report from measured requests.

### Out of scope
WhatsApp, phone calls, UPI execution, bank connections, automatic reminders, supplier ordering, inventory forecasting, credit scoring, lending, multi-shop sync, a custom trained speech model, agent orchestration, and continuous background listening.

## 4. Default implementation

For a new repository: React + TypeScript + Vite client, Node + TypeScript server, SQLite on the server for the authoritative ledger. Use a schema validator at every model boundary and a small maintained SQLite library compatible with the available runtime. Prefer familiar tools and compatible current stable versions; inspect official documentation before using unfamiliar APIs. Lock dependency versions. Avoid speculative infrastructure or unnecessary packages.

Use one process/server deployment that serves the built frontend and API, with persistent storage for SQLite. During development a Vite proxy is acceptable. Do not deploy SQLite onto ephemeral/serverless storage and claim persistence. Document the local Windows setup as well as the deployed configuration if deployed.

Speech and intent adapters:
- Backend speech adapter accepts short recordings and returns a transcript from a real configured provider.
- Backend intent adapter turns transcript plus limited conversational context into a strict structured proposal.
- Keep provider choice configurable using server-only environment variables. Prefer one available provider for both tasks. If none is configured, finish manual entry and show a clear setup state for voice.
- Never expose keys in frontend code, logs, errors, exports, or screenshots.
- No silent substitution of canned transcripts for live audio.
- Optional fixture mode must be explicitly labelled "Sample input" throughout. It cannot count as a live voice test.
- Provide an editable transcript fallback that goes through the same validation and preview path. Label it typed input.

Recommended folders: client/, server/, shared/, tests/, docs/. Keep domain logic separate from speech/provider code. No model training or GPU dependency.

## 5. Transaction rules: non-negotiable

Store money as integer paise; format in INR for display. Parse decimal strings safely without floating-point money arithmetic. Reject zero, negative, non-finite, excessive, or more-than-two-decimal inputs. Use a configurable prototype entry limit, initially Rs 10,000, and explain it as a prototype limit.

Balances must be derived from immutable ledger entries, never invented or directly changed by the language model. Credit increases outstanding; repayment decreases outstanding. Reject repayment above current outstanding in the MVP and ask the owner to review it. Do not add deposits or negative customer balances implicitly.

Every write is atomic and has a client-generated operation ID. Enforce uniqueness in the database. A retry of the identical request returns its existing receipt; reuse of an operation ID with different content is rejected. Persist operation IDs before sending and reuse them after uncertain network outcomes. Disabling a button alone is not sufficient duplicate protection.

Corrections are explicit ledger events, not deletion or editing of original entries. For changing a credit's customer, atomically reverse its effect on the original customer and append the replacement credit to the selected customer, linked to the original. A second reversal must fail. Never apply an old correction to a newer unrelated transaction. Validate the target's version/status inside the write transaction. If moving a credit would make the original customer's balance invalid after later repayments, reject the shortcut and ask for review. Similar rules apply to reversing repayments. P0 can limit corrections to the most recent eligible transaction and clearly explain this limit.

Store a server-issued confirmation proposal with ID, canonical fields, expiry, and target version. Confirmation submits the proposal ID and operation ID; the backend validates the stored proposal again. The client and model cannot bypass validation by submitting arbitrary "confirmed" fields. Expired/stale proposals require a new preview.

## 6. Suggested data model and API

Tables:
- shops: ID and display name; one sample shop in the MVP.
- customers: ID, shop ID, name, distinguishing label, timestamps.
- proposals: ID, shop ID, typed canonical action, target/version if applicable, state, expiry, timestamps.
- operations: unique operation ID scoped to shop, canonical payload hash, resulting receipt ID.
- ledger_entries: ID, shop/customer IDs, entry type, amount_paise, related/original entry ID, operation ID, timestamp.

Index shop/customer histories and enforce relevant foreign keys and uniqueness. Keep entry-type semantics explicit, including reversal signs. Return balances from a single consistent database snapshot where needed. Never infer identity from name alone.

Suggested routes, adapt consistently:
- GET /api/health
- GET/POST /api/customers
- GET /api/customers/:id/ledger
- GET /api/activity
- POST /api/transcribe
- POST /api/interpret
- POST /api/proposals (validated manual entry)
- POST /api/proposals/:id/confirm
- POST /api/proposals/:id/cancel
- GET /api/operations/:operationId (recover uncertain write outcomes)

LLM output can propose these intents only: ADD_CREDIT, RECORD_REPAYMENT, CORRECT_LAST_CUSTOMER, REVERSE_LAST, SHOW_BALANCE, NEEDS_CLARIFICATION, UNSUPPORTED. Use a discriminated schema with nullable fields as appropriate, plus customer query, amount string, correction target, and missing fields. The backend resolves IDs, checks amounts, and decides whether clarification is required. A model's self-reported confidence is not calibrated evidence of correctness. Treat transcripts and customer names as untrusted data, not instructions. No arbitrary SQL, code execution, tools, external links, or model-directed writes.

"Ramesh ko chalis diye" is ambiguous: ask whether this means a credit entry or repayment; do not guess. Context for "nahi, Suresh" must identify an eligible last action, not merely the last displayed customer. Clarification can use accessible buttons and optional follow-up speech through the same pipeline.

## 7. Network and offline behaviour

Define the distinction precisely:
- Local demo: the server and SQLite run on the laptop. If external internet stops, the already-loaded UI and local manual API can still work; cloud speech/intent cannot. Demonstrate this honestly with an actual external-network interruption, not browser-wide offline mode that also blocks localhost requests.
- Hosted app: loss of the server connection means authoritative writes cannot complete. Existing cached records may be viewed. Manual entries may be retained locally as drafts marked "Not saved to ledger"; do not include them in authoritative balances. On reconnect, explicitly submit/revalidate with the original operation ID and resolve uncertain outcomes.

P0 need not implement distributed offline sync. Never show a saved checkmark before server persistence succeeds. Provider failure must not lose the user's visible transcript or manual draft. Cancel or timed-out interpretations must not later overwrite a newer proposal. Use request IDs/cancellation and deterministic state transitions.

## 8. Premium, accessible interface

Visual direction: warm off-white background, dark ink text, one restrained deep teal accent, generous spacing, subtle borders, crisp type, minimal shadows. No neon, heavy glass effects, decorative gradients, fake analytics, or large marketing hero. Use an appropriate readable Devanagari font with robust fallback; bundle fonts if licensing and offline operation allow. One clear task per state.

Home: shop name, connection status, outstanding total, large mic control, manual-entry option, recent transactions. Credit/repayment labels must be explicit; avoid ambiguous signed amounts alone. Customers: search and clear distinguishing labels. Activity: chronological receipts with linked corrections. Add sample-data label and a guarded demo reset in Settings, never a dangerous one-tap reset on the main screen.

Voice states: idle, permission requested, recording, processing, clarification, preview, saving, saved, error. Show elapsed recording time and a stop button; cap recordings at 20 seconds. Stop tracks on stop/cancel/unmount. Detect microphone unavailability and unsupported recording formats. Ask permission after deliberate user interaction. Use HTTPS or localhost as required by the browser. Handle denied permission without trapping the user.

Use large touch targets, semantic buttons/forms, visible focus, readable contrast, keyboard completion of all core flows, screen-reader labels and polite status announcements, reduced-motion support, and no colour-only messages. Keep core controls visible on a 360px-wide screen with the software keyboard open. Test Android Chrome and desktop Chrome/Edge where available; report actual tested environments.

## 9. Privacy and deployment boundaries

Use fictitious customers in the public demo. Do not retain raw audio by default; discard it after processing and document provider transmission/retention boundaries based on the configured service. Do not claim local/private AI when cloud APIs process recordings. Avoid storing transcripts unless needed and disclosed. No continuous monitoring.

Cap request/audio sizes, validate content types, add provider timeouts and basic rate limiting, sanitize public errors, and use parameterized database queries. If a public deployment is made, use a protected demo session and isolated demo shop. Do not expose a writable shared ledger or API keys. Use secure session handling and same-origin/CSRF protections appropriate to the implementation. Localhost-only is an acceptable completed prototype if public deployment cannot be secured in time; document it and provide a reproducible run command.

## 10. Milestones and time allocation

Use percentages of the remaining time, not an assumed full-day budget. Keep the last 20% for verification, recording, and submission. If the event deadline is near, reduce scope before cutting ledger correctness.

M1 (first 25%): repository setup, domain model, SQLite migrations/seed, manual credit/repayment, preview and persistence. Verify Rs 40 credit then Rs 20 repayment equals Rs 20.

M2 (next 20%): real recording/transcription, structured interpretation, customer resolution, missing-field clarification. If credentials are missing, provide .env.example and exact setup requirements, finish independent work, and report voice as unverified.

M3 (next 20%): correction/reversal, linked activity history, idempotency, stale proposal checks, error recovery and network boundaries.

M4 (next 15%): responsive accessible polish, provider/setup states, performance instrumentation, documentation. Only add P1 if P0 is complete.

M5 (final 20%): focused tests, browser review, genuine demo rehearsal, screenshots, evidence report, presentation outline and script. Fix observed issues; do not add new features.

## 11. Acceptance checks

Automated domain/API tests must cover behaviour, not implementation mirrors:
1. Rs 40 credit to Ramesh, corrected to Suresh, then Rs 20 repayment: Ramesh Rs 0, Suresh Rs 20; linked original/correction/repayment preserved.
2. Two Ramesh customers: clarification; no write until identity is selected and confirmed.
3. Missing/ambiguous amount or direction: no database write.
4. Double tap, retry after timeout, and concurrent identical requests: one economic effect and the same receipt.
5. Same operation ID with changed payload: rejected.
6. Expired proposal, stale target, repeated reversal, and correction causing an invalid balance: rejected without partial writes.
7. Overpayment, negative/zero amount, invalid precision, and entry limit: rejected.
8. Cancelled or out-of-order interpretation: cannot replace a newer active proposal or create a write.
9. Server restart/refresh preserves ledger; failed transaction leaves no partial correction.
10. Prompt-like text inside customer/input data cannot bypass schema or authorize writes.

Browser verification: permission denied, provider error, slow response, refresh, mobile viewport, keyboard navigation, text overflow, microphone cleanup, and accurate saved/pending/failed UI. If a browser check cannot be run, mark it unverified rather than passed.

Create a small evaluation set with Hindi script, transliteration and mixed-language commands; amounts in words/digits, duplicate names, corrections, ambiguous direction, and unsupported requests. Aim for 20-30 cases if time permits. Include benign/ambiguous cases and separate typed parser tests from recorded-audio tests. Typed text does not validate speech recognition. Compare exact customer/action/amount and whether clarification was correctly requested. Report counts and the small sample size; do not generalize to real-world accuracy. Test street-noise recordings only if actually available and permitted.

Measure end-to-end audio-stop-to-preview and confirm-to-receipt times separately. Report sample size, median and p95 only when meaningful; otherwise list observed timings. Track known token/audio usage and calculate cost only from verified provider prices, with date/provider/model recorded. Mark unavailable measurements unknown. No invented accuracy, latency, user research, savings, or cost claims.

## 12. Deliverables in the repository

- Working application and meaningful automated tests.
- README.md: purpose, prerequisites, exact install/run/test commands, credentials, supported browsers, local vs hosted network behaviour, and limitations.
- .env.example with placeholders and server-only variables; never real secrets.
- docs/ARCHITECTURE.md: data flow, confirmation boundary, money rules, corrections, storage and privacy.
- docs/DEMO_SCRIPT.md: the timed demonstration below.
- docs/SUBMISSION_OUTLINE.md: 8-10 slide outline with actual screenshots to capture, repository/demo URL placeholders clearly marked, and honest limitations.
- docs/VERIFICATION.md: commands/results, measured evidence, checks not run, known issues, and real vs fixture/provider status.
- docs/AI_USAGE.md: disclose Codex, other AI tools, pre-existing components and third-party resources. Do not invent commit history or user testing.
- Screenshots of the actual running application if browser tooling is available; no mock screenshot represented as real.

Do not automatically publish a repository, deploy, send messages, or submit the entry. Finish the locally reviewable project first; provide the concrete next steps. If deployment/repository publishing is later explicitly authorized, carry it out within that scope. Ensure hosting supports durable SQLite or adapt storage deliberately.

## 13. 2 minute 45 second demonstration

0:00-0:15: Introduce the real task: a busy tea-stall owner remembering customer credit. Use a truthful scenario, not a fabricated testimonial.
0:15-0:45: Record the Hindi Rs 40 credit instruction, show transcript/preview, confirm, and open the saved receipt.
0:45-1:10: Say "Nahi, Ramesh nahi, Suresh", preview/confirm correction, and show linked history.
1:10-1:35: Record Rs 20 repayment and show Rs 20 outstanding.
1:35-1:55: Ask for a transaction against an ambiguous customer and demonstrate clarification before any write.
1:55-2:15: Demonstrate the actual network limitation and fallback appropriate to local or hosted mode. Never fake cloud speech while disconnected.
2:15-2:35: Refresh; show persistence, receipt history, and a concise genuine verification result.
2:35-2:45: State supported scope, one material limitation, and repository/demo links.

Keep the central workflow continuous where practical. Label fixture data and disclose edits; do not splice failed actions into apparent live successes. Clear audio, readable screen zoom and captions matter more than cinematic animation.

## 14. Presentation outline

1. User and problem: recording credit while working.
2. Product: speak, review, confirm; one actual screenshot.
3. End-to-end working journey and balances.
4. Differentiation: clarification, correction and retry safety.
5. Architecture and deterministic financial logic.
6. Simplicity/accessibility and actual user feedback if collected.
7. Evidence: tests, command evaluation, measured latency/cost if available.
8. Privacy, network limits and current boundaries.
9. Next steps grounded in observed needs.
10. Working code/demo links and AI/resource disclosure.

This outline follows the supplied guide: real-world usefulness 25, working technology 25, simplicity 20, speed/safety/readiness 15, honest presentation 15, and working video bonus up to 15. Do not predict an awarded score or assert a judge's personal preferences as fact.

## 15. Completion response expected from Codex

Report what works, exact startup/test commands, observed verification results, missing credentials or unverified integrations, known limitations, and where the demo/presentation materials are. If blocked, complete independent portions and identify the specific remaining dependency. Never finish with a plan while authorized implementation remains possible.
