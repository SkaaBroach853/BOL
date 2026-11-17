# BOL verification

17 November 2026, Asia/Kolkata. Local speech, the voice studio, broader Hinglish interpretation, voice confirmation/retry, disconnected manual storage and the outstanding-payments dashboard are implemented. This supersedes the earlier report. No cloud AI adapter or API credential is used.

## Observed checks

| Command | Result |
|---|---|
| `npm test` | 17 tests passed, zero failed. Domain/API invariants, language examples, command allowlist and contact normalization. |
| `npm run build` | Strict TypeScript and production Vite build passed. |
| `npm run test:browser` | 13 Edge tests passed, zero failed. Offline reload/sync, dashboard/phone validation, actual recorder energy/pause handling, money/correction journeys and seven axe scans. |
| `npm run test:voice-ui` | Passed with the real browser, real MediaRecorder, real local model and real ledger endpoints; four synthetic English audio clips. |

The original 26 authored Hindi/transliteration/English parser cases still pass. An additional 14 typed cases cover the owner's examples, compound amounts, existing-balance statements, conflicting customers and invalid amounts. Exact confirmation/retry/cancel phrases and negative/unknown/question forms have separate tests. These are authored regression examples, not an independent benchmark or evidence of human ASR accuracy.

Environment: Windows, Node 22.17.0, Python 3.13.2, installed Microsoft Edge headless, faster-whisper 1.2.1, PyAV 15.1.0, Whisper base multilingual / CPU int8. Node SQLite emits its experimental API warning. No physical Android or assistive-technology certification is claimed.

## Actual local voice interaction

`scripts/verify-voice-ui.ts` generates/reads offline Windows TTS WAVs, plays their audio into genuine Web Audio streams, records them with the browser's real MediaRecorder, and uploads the encoded recordings to the real local transcription endpoint. Only the microphone source is synthetic; no transcript or API response is substituted.

Observed sequence:

1. Suresh credit forty rupees -> `Suresh Credit 40 Rupees` -> INR40 credit preview, zero ledger balance.
2. Listen again -> `Listen again.` -> cancel preview, start fresh recording; still zero ledger events.
3. Repeat credit -> new INR40 preview.
4. Confirm -> `Confirm` -> one confirmed ledger event, exactly 4000 paise outstanding.

The test observed an active real-sample waveform and automatic stopping after a pause. HTTP transcription observations were 15,787 ms for the first cold request, then 3,886 / 4,874 / 4,885 ms. These measure HTTP speech endpoint elapsed time, not complete conversational latency. One four-clip synthetic session is too small for accuracy or percentile claims. The visible first audio-stop-to-result was approximately 15,904 ms; the captured confirmation-to-receipt was 403 ms.

Evidence: [voice-ui-verification.json](voice-ui-verification.json), plus `screenshots/studio-real-voice-recording.png`, `studio-real-voice-processing.png`, `studio-real-voice-preview.png` and `studio-real-voice-receipt.png`. The older `local-speech-verification.json` retains the separate single-WAV HTTP smoke-test observation.

Test infrastructure initially could not access installed Windows TTS voices within the sandbox; generating those local test WAVs in ordinary Windows PowerShell resolved that issue. A browser-fixture serialization issue was corrected before the passing actual-audio run. Neither was handled by replacing ASR with canned text.

## Offline and sync evidence

The browser test waits for the real production service worker, disables the browser network, saves a manual INR125.50 entry to IndexedDB and reloads while still offline. The shell and saved draft remain available. Confirmed displayed/server balances remain zero. It reconnects, chooses Review & sync, checks the new server-issued preview, confirms and reloads: INR125.50 outstanding, exactly one server ledger event, local queue removed. `screenshots/studio-offline-queue.png` also captures an actual disconnected reload in an isolated shop.

This is genuine browser-to-local-server queue/review behavior. It does not claim cloud or multi-device synchronization, background commits or inclusion of drafts in authoritative balances. A physical external Wi-Fi disconnection with localhost still reachable remains unrehearsed. Offline browser mode is separately disclosed because it also blocks localhost. Clearing site storage can remove unsynchronized drafts.

## Dashboard and WhatsApp evidence

The browser test saves Meena's INR500 credit, opens Dashboard, verifies the due amount, rejects an invalid phone number, saves a normalized Indian number and reloads to check persistence. It verifies a real `https://wa.me/...?...` link containing the current INR500 balance. `studio-pending-dashboard.png` is the actual screen.

No WhatsApp message was sent during development. Account availability, WhatsApp app handoff and delivery are unverified. This implementation opens a prepared chat for the owner to review/send; it does not report delivery or implement the WhatsApp Business API.

## Financial and browser coverage

Retained financial checks include INR40 credit -> linked movement -> INR20 repayment; immutable originals; missing/duplicate identity/direction/amount clarification; overpayment and invalid money rejection; eight concurrent identical confirmations; operation payload conflicts; expiry/cancellation/stale targets; repeated reversals; injected rollback; and file-database close/reopen persistence. No power-loss or full OS crash test has been performed.

A separate migration test reopens a SQLite ledger without the phone column, verifies that the existing customer, INR125.50 balance and immutable event survive, then saves a phone and adds another customer successfully.

Browser checks include manual/correction/repayment, refresh/CSV, typed errors and stale-result cancellation, interrupted confirmation recovery, permission-denied fallback, recorder cleanup on cancel/navigation, the actual 20-second cap, a real oscillator-driven waveform/pause check, a 360px viewport, keyboard completion, no horizontal overflow, offline reload/queue and the dashboard. Controlled HTTP errors and generated streams are explicitly test fixtures, separate from real-model verification above.

Axe detected **zero violations across seven scans**: Home desktop, manual-entry dialog, Customers, Activity, Dashboard, Settings and Home mobile. Home desktop, manual dialog and mobile each retain one incomplete/manual-review item. Contrast issues found in the first redesign pass were fixed and the browser suite rerun. Zero automated violations is not complete accessibility certification. Actual screenshots were inspected at desktop/mobile sizes; these are browser renders, not mockups.

## Remaining limits

- Human Hindi/Hinglish, dialects, street noise, hardware microphones, OS permission prompts, physical Android Chrome and screen readers remain unverified.
- Interpretation is bounded application code, not a newly trained universal language model. Ambiguous debt assertions require clarification; recognition is not guaranteed error-free.
- Local inference can take seconds, especially on a cold CPU worker. The fixed energy/pause threshold can react to noise or miss quiet speech; explicit stop/cancel remains.
- Voice confirmation is an explicit alternative for the displayed proposal; short spoken commands can still be misrecognized. Turning off Voice conversation leaves tap/keyboard confirmation.
- Disconnected writes are local drafts until reviewed and committed online. No cloud/multi-device sync, banking/UPI execution, automatic WhatsApp delivery, public authentication or hosted deployment.
- Latest eligible transaction corrections only, one active local shop, no archive-browsing UI. Keep SQLite backups and preserve unsynced browser storage.

GitHub publication was authorized by the owner. Databases, audio, model weights, Python environment and credentials are excluded from Git. No public deployment, message sending, video recording or entry submission is claimed.
