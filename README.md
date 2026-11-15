# BOL · बोल

A working Hindi/English credit ledger prototype for a small tea stall. Give credit, review a server-issued preview, explicitly confirm, correct the latest transaction without erasing history, and record repayments. Apple-inspired restraint: warm neutral surfaces, deep teal, readable type, and focused controls.

**Local prototype.** Four clearly fictitious customers start at zero, including two Ramesh customers with distinguishing labels. No transactions are fabricated. Source repository: [BOL](https://github.com/SkaaBroach853/BOL). No public application deployment or submission has been made.

## Quick start · Windows PowerShell

Prerequisite: Node.js **22.17 or later**, with npm. Tested here on Node 22.17.0 / npm 10.9.2 / Windows. SQLite is bundled with Node; no Python, GPU, database server, or native compiler is needed. Node 22 prints an experimental SQLite warning; the ledger uses the real file-backed SQLite engine.

```powershell
cd "D:\Downloads\Vibe X Codes\bol"
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3000**. Keep the terminal running. Stop with Ctrl+C. Commands work from the project directory on macOS/Linux too; replace the `cd` path.

For development with React hot reload and the API in one process:

```powershell
npm run dev
```

Default SQLite file: `data/bol.sqlite`. Refreshing or restarting keeps it. Back it up with the server stopped, including any `-wal` / `-shm` files if present. Do not put it on ephemeral serverless storage. Tests use a different database.

## Try it without credentials

1. Enter manually → Credit given → Ramesh · Auto driver → `40` → Review → Confirm & save.
2. Done → Correct latest transaction → Suresh · Book shop → Preview customer correction → Confirm & save.
3. Enter manually → Repayment received → Suresh · Book shop → `20` → Review → Confirm & save.
4. Customers shows Ramesh ₹0 and Suresh ₹20. Activity preserves all four linked events. Refresh to verify persistence.
5. Expand typed input and enter `Ramesh ko chalis rupaye udhaar likho`: both Ramesh identities are offered; nothing changes until selection and confirmation.

Typed instructions use a **disclosed bounded local rule parser when no key is configured**. It supports common credit/repayment/correction/balance phrases, selected Hindi amount words, transliteration, Hindi digits and decimal digits. Complex or ambiguous input should be completed through the explicit form. This is not speech recognition or an offline LLM. The microphone never returns a sample transcript.

## Real voice setup · optional

Manual entry does not need a key. For real audio transcription and model interpretation, create a local `.env`:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Set `OPENAI_API_KEY` to a funded OpenAI API project's key with access to the configured models. Defaults are `OPENAI_TRANSCRIBE_MODEL=gpt-transcribe` and `OPENAI_INTENT_MODEL=gpt-4.1-mini`. Model names are configurable and account access must be checked. Restart the server after changing environment variables. Do not prefix a secret with `VITE_`, commit `.env`, or enter a key into the browser. The health endpoint reports only whether a key exists, never its value. “Configured” does not prove valid credentials or model access.

Tap the microphone deliberately, grant permission, speak Hindi/English, and stop. Recording caps at 20 seconds. The backend sends audio to `/v1/audio/transcriptions`, then sends the transcript and limited last-action context to `/v1/responses` with a strict schema. Check the visible transcript, action, identity, and amount before confirming. All monetary actions still require a tap or keyboard confirmation. An edited transcript is labelled typed input.

No API credentials were available during implementation. **Live transcription, live model interpretation, speech accuracy, voice latency, token/audio usage and cost remain unverified.** Adapter tests use explicitly named mock transports. Browser recorder tests use generated audio only to check lifecycle mechanics. They are not live speech tests.

## Verification commands

```powershell
npm test
npm run build
npm run test:browser
```

The browser suite uses installed Microsoft Edge and a separate server on port **3101**, with a separate `data/browser-tests.sqlite` database and cloud credentials disabled. It creates actual-interface screenshots in `docs/screenshots/`. Keep port 3101 free. Build before running it. Browser tests create fresh sample shops in the test database only.

If Edge is unavailable, install Playwright Chromium and select it:

```powershell
npx playwright install chromium
$env:BOL_BROWSER_CHANNEL = "chromium"
npm run test:browser
```

The test runner starts direct Node children and stops its owned server, avoiding npm/cmd process-tree teardown issues observed on this Windows host. Automated accessibility checks use axe, alongside keyboard and viewport checks. Passing automation does not replace real assistive-technology or physical-device testing. See [verification evidence](docs/VERIFICATION.md).

## Financial and recovery rules

- Money is integer paise; strict decimal-string parsing. Positive amounts only, maximum two decimals, default limit ₹10,000 per entry. Overpayments are rejected.
- A preview alone never writes money. Confirmation submits only a stored proposal ID and a persisted client operation ID. Proposals expire after five minutes.
- SQLite transactions, foreign keys, a unique operation key and canonical-payload hash prevent duplicate economic effects. Identical retries return the original receipt. Changed requests cannot reuse an operation ID.
- The browser persists an operation ID before sending confirmation. If the response is lost, it displays an unknown result and offers receipt lookup / retry with the same ID. Refresh also checks for the saved receipt. Browser storage must be available for confirmation.
- Only the latest eligible ledger event can be reversed; only the latest credit can move to another customer. Correction appends a linked reversal and replacement atomically. Older or already reversed targets are refused. Earlier history is never edited/deleted.
- Customer search uses stable IDs and distinguishing labels. Duplicate names require explicit selection.
- Demo reset is guarded by `RESET DEMO` in Settings. It archives the old shop and creates a fresh one; original ledger events remain in SQLite. This prototype has no archive-browsing UI.

## Network, privacy and deployment boundary

The server binds only to loopback. It validates localhost hosts, same-origin mutations and a server-session CSRF token, limits requests and recording sizes, and uses parameterized SQL. This is a single local demo without user accounts. Do not tunnel it publicly or describe it as a secure hosted app. Public deployment needs authentication, isolated shops, TLS, durable storage, and another security review.

If external internet goes away while the local server is still running, manual entry can work from the loaded app; cloud voice cannot. An actual external-network disconnection rehearsal has **not** been performed. If the local server is unreachable, current loaded records remain visible and labelled as such; drafts are not counted in authoritative balances. Manual draft fields survive refresh in browser storage. There is no service worker, installable PWA, offline page reload, or distributed sync.

Raw audio is not written to disk; transcripts are not stored in the ledger or logs. They remain temporarily in the browser and request memory. Manual drafts, customer-create retry details and pending confirmation IDs are kept in local storage. With voice configured, audio and transcripts leave the computer for OpenAI. `store:false` is sent for Responses; this is not a zero-retention guarantee. Provider/account policies apply; see [architecture and privacy](docs/ARCHITECTURE.md).

## Current limitations

Tested interface: installed desktop Microsoft Edge, headless, and 360px responsive/short-height viewport emulation. Physical Android Chrome, desktop Chrome/Safari, screen-reader use, actual software keyboard, street noise, regional dialects and live voice remain untested. The interface primarily uses English action labels with Hindi cues and Devanagari fallback fonts; it is not a fully localized Hindi UI.

The app is intentionally small: one active local sample shop, no authentication, no bank/UPI/WhatsApp integration, no remote sync, no voice-only confirmation, no customer editing/deletion, and no automated reconciliation of older transactions. The typed rule parser is limited, and cloud interpretations can be wrong: always review. Recording length is capped in the browser; the server enforces MIME/header and 5 MiB limits, not adversarial media-duration decoding. System fonts are used without remote font requests. CSV exports escape fields and neutralize spreadsheet-formula prefixes.

## Repository guide

`client/` React interface and microphone lifecycle; `server/` API, provider, deterministic ledger and SQLite wrapper; `shared/` boundary schemas/types; `tests/` domain/API, typed evaluation and real-browser checks.

- [Architecture](docs/ARCHITECTURE.md)
- [Demo script · 2:45](docs/DEMO_SCRIPT.md)
- [Submission outline](docs/SUBMISSION_OUTLINE.md)
- [Verification report](docs/VERIFICATION.md)
- [AI and resource disclosure](docs/AI_USAGE.md)
