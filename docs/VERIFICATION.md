# BOL verification report

Verification date: **15 November 2026**, Asia/Kolkata. Local Windows host, Node **22.17.0**, npm **10.9.2**, installed Microsoft Edge through Playwright's `msedge` channel. Checks were completed before repository publication; the owner subsequently authorized the source upload to https://github.com/SkaaBroach853/BOL. No public application deployment. No real API key was available.

## Final command results

| Command / check | Observed result |
|---|---|
| `npm test` | **13 passed, 0 failed**. Domain, HTTP API, real-provider adapter contract using mock transports, and typed-rule evaluation. |
| `npm run build` | **Passed** after final application changes. TypeScript strict check and Vite production build. Latest output: JS 234.54 kB / 73.73 kB gzip; CSS 30.04 kB / 6.84 kB gzip. |
| `npm run test:browser` | **9 passed, 0 failed**, final run approximately 1.3 minutes. Real installed Edge, headless, actual production server + SQLite, port 3101. |
| axe browser scan | **0 detected violations** in Home desktop, manual-entry dialog, Customers, Activity, Settings dialog, and Home mobile, using WCAG 2 A/AA and 2.1 AA tags. Five desktop/dialog scans each contain one axe item needing manual review; mobile has zero incomplete items. This is not full accessibility certification. |
| Patched dependency installation audit | **0 known vulnerabilities reported** after upgrading Vite to 7.3.8 and Zod to 4.6.7 and adding axe. Dependencies are exact-version locked. |
| `npm start` | Observed successful startup at `http://127.0.0.1:3000`; file-backed SQLite and honest voice-not-configured status. Production frontend also exercised by all browser tests. |
| `npm run dev` with `PORT=3002` | Observed startup; local health and frontend requests succeeded. Hot-reload behavior itself was not separately exercised. |

The Node 22 runtime emits its experimental SQLite API warning. The initial better-sqlite3 native install failed because the local compiler could not launch cmd.exe; implementation switched to Node's maintained SQLite binding. No native compiler is now required. Earlier checks caught receipt object-normalization, implicit form-label matching, retained-text visibility, contrast, and Windows test-server teardown issues; they were fixed and the final checks rerun. One intermediate Edge run closed its browser process between tests; after awaiting CSV download completion, the final full run was clean. No automatic test retries are enabled.

## Financial acceptance evidence

| Requirement | Evidence / practical boundary |
|---|---|
| ₹40 credit to Ramesh → move to Suresh → ₹20 repayment | Domain test and real browser journey: Ramesh ₹0, Suresh ₹20. Original credit, linked reversal, replacement credit and repayment all preserved (four events, three operations). |
| Duplicate names | Seeded Ramesh Auto driver / Electrician. Typed interpretation and browser clarification expose both labels. No money moves until selection, preview and confirmation. |
| Missing amount / ambiguous direction | Domain tests keep ledger unchanged. `Ramesh ko chalis diye` requests direction. Missing/ambiguous amounts lead to clarification. |
| Double tap / retry / concurrency | Eight concurrent identical HTTP confirmations yield one economic effect and the same receipt. Separate domain test retries the same operation. |
| Changed operation payload | Reusing an operation ID with another proposal is rejected. Confirmation bodies with extra `confirmed` fields fail strict schema validation. |
| Expired / cancelled / stale proposal | Domain tests reject expiry and cancellation. A later repayment makes an earlier correction stale; rejection leaves both balances and history untouched. |
| Repeated reversal / invalid-balance shortcut | A reversed or non-latest target cannot be targeted again. Correction of an earlier credit after repayment is blocked by the stricter latest-event rule. Repayments are rechecked against outstanding on confirmation. |
| Partial correction failure | Injected SQLite failure on replacement insertion rolls back the reversal and receipt. Retry after removing the injected fault succeeds once. |
| Invalid money / overpayment | Reject negative, zero, NaN, Infinity, exponent notation, excessive precision, over-limit values, malformed strings and overpayment. Exact `0.01` and `40.10` paise conversion is tested. |
| Cancelled / out-of-order input | Actual browser aborts a delayed interpretation, opens a new ₹25 Meena preview, and verifies the old result cannot replace it or write money. |
| Refresh / durable storage | Actual browser refresh preserves balances and history. Domain test closes/reopens a real file-backed database and recovers the same receipt. A full OS/process crash or power-loss test was not performed. |
| Prompt-like input | Typed prompt-like input stays unsupported, model schema rejects executable/unknown actions and extra fields, and API rejects bypass fields. No model has SQL/tool access. No live adversarial-model evaluation was performed. |
| Unknown save result | Browser test lets the real API commit, drops its response, checks unknown-result UI, reloads, and recovers the original receipt once. A lost response is never represented as a definite failed write. |

## Browser review

Actual production interface screenshots were captured and visually inspected: desktop home, preview, saved journey, linked activity, clarification, mobile home and mobile receipt. These are screenshots of the working app, not generated mockups.

- `screenshots/01-home-desktop.png`
- `screenshots/02-confirm-preview.png`
- `screenshots/03-home-saved.png`
- `screenshots/04-activity-linked.png`
- `screenshots/05-clarification.png`
- `screenshots/06-home-mobile.png`
- `screenshots/07-receipt-mobile.png`

360 × 740 viewport: microphone and manual entry fit above bottom navigation; assertions check their bounds. A 360 × 460 shortened viewport checks keyboard-style constrained space, accessible form submission and confirmation, without horizontal overflow. This is emulation, **not a physical software-keyboard test**. Keyboard tests check the skip link, focused buttons and Enter completion. Native dialogs provide focus trapping; visible focus and reduced-motion styles are implemented.

Permission-denial handling is exercised using a controlled `getUserMedia` rejection; physical OS permission prompts were not tested. Real MediaRecorder is exercised with a generated browser audio stream, checking track cleanup on cancel and navigation. A separate real-time 20-second recording reaches the actual unconfigured `/api/transcribe` endpoint, returns its honest missing-key error and produces no fabricated transcript or proposal. This tests recording mechanics and fallback, not speech recognition.

Provider 502 and delayed-response UI paths are controlled HTTP failure tests. They verify retained editable text, cancellation, accurate state and no balance change; they are not live provider outage observations. The saved-response-loss test uses an actual persisted write and drops only the response.

Detailed artifacts: `accessibility-results.json`, `browser-timings.json`; machine-readable full test result is generated at `test-results/browser-results.json` (ignored by Git), with traces retained for failures.

## Typed evaluation versus audio evidence

**26 / 26 hand-authored typed-rule cases passed** for exact action, customer query and amount. Cases include Hindi script, transliteration, mixed English, amount words, Devanagari/digit amounts, decimals, two Ramesh identities, corrections, ambiguous direction, missing amounts and unsupported tasks. Resolution tests separately check clarification/preview and no economic write.

The cases live in `tests/evaluation.test.ts`. This is a small developer-authored regression set. It does not establish real-world parser accuracy, live LLM accuracy, Hindi dialect coverage or speech recognition accuracy.

| Integration / input | Status |
|---|---|
| Manual API and persistent ledger | Actually exercised. |
| Typed local rules | Actually exercised, separately labelled. |
| Browser recording / 20-second cap / track cleanup | Actual MediaRecorder with generated audio; no human speech recognition. |
| Real OpenAI request adapter | Implemented against documented HTTP endpoints; multipart and structured-output contracts tested with explicit mock transports. |
| Live OpenAI transcription and intent | **UNVERIFIED — missing server-only API key, billing/model-access verification, and real recordings.** |
| Street noise / regional dialects | **Not tested; no recordings available.** |
| Application fixture mode | None; the application never fabricates voice responses. |

## Measurements

Latest browser central-journey confirmation-click → visible SQLite saved receipt: **259 ms, 217 ms, 185 ms (n=3)**. These include browser automation/rendering overhead on this machine and are listed as observations only; no p95 or broad latency claim. The app also displays each request's own confirm-to-receipt timing.

Audio-stop → transaction-preview timing is instrumented for configured live requests but **unknown**, because no successful live audio request was made. Generated-audio missing-key failure is not a substitute measurement. Token use, billed audio use and cost are **unknown**; no price-based cost estimate is invented.

## Not verified / remaining limitations

- Real credentials, live speech/model quality and model availability for the intended API project.
- Physical Android Chrome, desktop Chrome/Safari, actual software keyboard, screen-reader use and independent user feedback. Desktop Edge and viewport emulation were tested.
- Actual external Wi-Fi/Ethernet disconnection while keeping localhost available. The network boundary is documented; controlled request failures do not count as that rehearsal.
- No installable PWA, offline page reload, audio upload, readback, distributed sync, public hosted session or production authentication. Only the loaded app's records/drafts remain when the server connection is lost.
- One active local sample shop. Only the latest eligible transaction can be corrected/reversed. Archives remain in SQLite without a browsing UI; refresh other tabs after reset. No customer edit/delete or multi-user conflict workflow.
- English-first interface with Hindi cues, system-font Devanagari fallback and a limited typed parser. No claim of full localization or broad dialect coverage.
- Browser duration cap and server size/container-header checks exist; hostile-media full decoding/duration enforcement is outside this local prototype.
- Only the initial idempotent schema exists; future schema upgrades require explicit migrations. A full backup/restore, crash, power-loss, hostile-load and public security audit has not been performed.

## Reproduce and next credential check

From the project root: `npm ci`, `npm test`, `npm run build`, `npm run test:browser`, then `npm start`. The browser runner isolates its SQLite file and disables cloud credentials. Read README for Windows paths and browser installation options.

To verify live voice later, copy `.env.example` to `.env`, set a real `OPENAI_API_KEY` with access to the configured transcription/intent models, restart, record the three central Hindi utterances, inspect every preview and saved receipt, and record actual stop-to-preview timings. Add dated observations rather than changing unverified evidence into claimed historical successes. Do not publish or submit until separately authorized.
