# Local BOL architecture

This revision replaces the earlier cloud adapter. The running application has no OpenAI/other cloud inference call and ignores old cloud keys. `server/provider.ts` has been removed.

## Local agent flow

Browser MediaRecorder -> same-origin localhost upload -> `LocalSpeechAgent` -> persistent Python stdio worker -> local Whisper base / CPU int8 -> editable transcript -> `InterpretationAgent` -> `ReviewAgent` -> server-issued proposal -> explicit owner confirmation -> immutable SQLite ledger.

`server/agents.ts` contains bounded interpretation and review agents. They use the application's rule parser and strict intent schema; they are not autonomous general-purpose LLMs. `server/ledger.ts` owns financial authority. No model or agent has arbitrary SQL, code execution, cloud tools, or an automatic financial-write path.

The speech worker uses faster-whisper 1.2.1, a pinned compatible PyAV decoder and downloaded public model files. Python runs in project `.venv`, separate from system packages. Whisper loads `models/whisper-base` with `local_files_only=True`; runtime sets HF_HUB_OFFLINE and disables Hub telemetry. Model downloads occur only through the explicitly invoked setup script. Python audio is passed as base64 JSON lines in memory, decoded, checked for duration and processed; no recording file is created by normal inference. A test-only system-TTS WAV is stored under ignored data/.

One CPU worker is reused; concurrent speech requests return a busy message. Cancellation and timeout kill the owned worker; the next request starts another. Errors are sanitized and never trigger a canned transcript. There is no network fallback. The client waits up to 130 seconds; the local speech deadline defaults to 120 seconds. Browser recording caps at 20 seconds and decoded audio over 21 seconds is rejected to allow container rounding.

## Confirmation and ledger

Manual and interpreted actions both use Zod schemas and stored canonical proposals with five-minute expiry. Confirmation submits proposal ID and a persisted client-generated operation ID. SQLite BEGIN IMMEDIATE revalidates customer, money, current outstanding and correction target version, then atomically commits ledger events, operation receipt and proposal status. Interpretation alone never changes money.

Amounts are decimal strings converted into integer paise, with no floating-point financial arithmetic. Reject negative/zero amounts, invalid precision, exponent notation, overpayment and amounts beyond the default 10,000-rupee prototype limit. Outstanding is SUM(delta), not an editable field.

Correction is limited to the latest eligible event. Moving a credit appends its linked reversal plus replacement credit in one transaction. The original stays immutable. A unique reversal index, target ID/sequence validation, foreign keys and UPDATE/DELETE triggers preserve history. Identical operation retries return the original receipt; reuse with another proposal fails. Failed replacement inserts roll back the reversal.

SQLite uses WAL, foreign keys, FULL synchronous mode and a busy timeout, via Node's bundled SQLite binding. Tables: shops, customers, proposals, operations, ledger_entries and active-shop metadata. Snapshots use a consistent read transaction. Reset creates a new shop and archives prior events without deleting them. This initial schema has no general upgrade migration engine.

## Network and security

The Node server binds to loopback and validates localhost hosts, mutation origin and a server-session CSRF token. Parameterized SQL, request/rate limits, 16 KiB JSON cap and 5 MiB audio cap remain. No user authentication is provided; this is a local demo, not a public service. Local browser-to-server HTTP is part of the app, not an external AI API.

Internet is needed for package/model installation only. With the server and installed model running, external internet is unnecessary for voice, typed instructions, manual entry or persistence. A physical Wi-Fi-disconnection rehearsal has not been performed. If localhost is lost, loaded records can remain visible and drafts are not counted in balances; pending confirmations recover with the same operation ID. No offline reload, PWA, distributed sync or production hosting is claimed.

Transcripts/audio remain local and are not deliberately logged or saved. Browser local storage retains manual drafts and pending write IDs. Names/transcripts are untrusted data and cannot bypass schemas or confirmation. Browser abort controllers and generation checks prevent stale results replacing newer previews. Media tracks stop on stop, cap, cancel, navigation or unmount.

## References and ownership

- https://github.com/SYSTRAN/faster-whisper
- https://huggingface.co/Systran/faster-whisper-base
- https://github.com/nodejs/node/blob/v22.17.0/doc/api/sqlite.md

The original Whisper weights are pretrained open resources, not a custom-trained model owned by this project. BOL owns its application-specific agent code and deterministic workflow. Human Hindi accuracy and physical-device coverage remain to be tested.
