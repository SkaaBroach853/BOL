# BOL - your local voice ledger

BOL now runs its speech model, interpretation agents, customer clarification and financial ledger on your own computer. **No cloud AI API, API key, subscription, or remote inference service.** The earlier cloud adapter was removed at the owner's request.

The interface keeps the Apple-inspired styling, mobile layout, confirmation previews, immutable correction history, customer search, receipts and CSV export.

## Start here - Windows PowerShell

Prerequisites: Node 22.17+ and Python 3.13 (tested on 3.13.2). No GPU or separate FFmpeg installation is needed. Use the project directory:

```powershell
cd "D:\Downloads\Vibe X Codes\bol"
npm install --include=dev
npm run setup:local
npm run build
npm start
```

Open **http://127.0.0.1:3000**. Keep the terminal running. Stop with Ctrl+C. On this development machine the local speech environment and model are already installed, so `npm start` is sufficient after the build.

`setup:local` creates an isolated `.venv`, installs faster-whisper and a compatible audio decoder, and downloads the open multilingual Whisper base model into `models/whisper-base`. This needs internet **once** and disk space for packages and weights. There is no login or key. Model/runtime files are ignored by Git, so a fresh clone must run this setup. Normal runtime loads local files only and sets Hugging Face offline mode. The model runs as CPU int8 and is loaded on the first recording; the first request may be slower.

For development use `npm run dev`. If Windows reports `tsx is not recognized`, run `npm install --include=dev` first. `tsx` is a pinned runtime dependency; do not install it globally.

## What the agents actually are

- **Speech agent:** a persistent local Python worker using the real pretrained Whisper base speech model. Audio travels from the browser to your own localhost server, then over process stdin. No cloud transcription.
- **Interpretation agent:** BOL's inspectable, schema-validated Hindi/English rule code extracts action, customer and rupee amount. It is a bounded rule agent, **not a general-purpose LLM**.
- **Review agent:** resolves stable customer IDs, asks for missing amount/direction or duplicate names, and produces a canonical server-issued preview.
- **Ledger:** only your explicit confirmation can commit the proposal, atomically, in SQLite. No agent can bypass this boundary.

These are your application's agent code and a downloaded open pretrained speech model. BOL does not claim to have trained the speech model from scratch. Whisper's open weights were originally released by OpenAI; using them locally is different from calling an OpenAI API.

## Try the working journey

1. Give Ramesh / Auto driver a credit of 40, review, then confirm.
2. Correct latest transaction, move it to Suresh / Book shop, review, confirm.
3. Record Suresh's repayment of 20, review, confirm.
4. Ramesh owes 0 and Suresh owes 20. Activity preserves the original credit, linked reversal, replacement credit and repayment. Refresh keeps them.

Use the microphone for real local transcription, or the manual form. Typed instructions run through the same local interpretation/review agents. Examples: `Suresh credit 40`, `Suresh ne bees rupaye de diye`, `Nahi Ramesh nahi Suresh`. Two sample Ramesh customers require label selection. `Ramesh ko chalis diye` asks for direction instead of guessing. Vocabulary is deliberately limited: use the form if a phrase is not recognized. Names and amounts must always be reviewed.

Four fictitious sample customers start at zero. Settings reset requires typing `RESET DEMO`, archives the prior shop in SQLite and starts a fresh sample shop. There is no archive-browsing UI.

## Verify

```powershell
npm test
npm run build
npm run test:browser
npm run test:local
```

The first three check domain/API behavior, strict TypeScript/build, and the real Edge interface. Browser tests use port 3101 and a separate SQLite database; they deliberately disable speech to test the missing-model state and recording error handling. Keep 3101 free. Edge is the default; Playwright Chromium can be selected with `BOL_BROWSER_CHANNEL=chromium` after installing it.

`test:local` additionally checks **actual CPU speech inference through HTTP upload, local agents, preview, and explicit ledger confirmation**. It uses a synthetic English WAV saying "Suresh credit forty rupees." in an in-memory test shop. On Windows it can generate the WAV with offline system TTS. This is a synthetic regression sample, not human Hindi recognition evidence. The audio stays under ignored `data/` and is not uploaded to a service.

See [current evidence](docs/VERIFICATION.md) and [local inference observation](docs/local-speech-verification.json). A real local run recognized `Suresh Credit 40 Rupees.` and proposed ADD_CREDIT / 4000 paise. Small sample: no broad accuracy claim.

## Financial correctness and persistence

Money uses integer paise, exact decimal-string parsing, positive amounts, two-decimal precision and a configurable default 10,000-rupee entry limit. Repayment above current outstanding is rejected. Balances are derived from immutable ledger events, never model output.

Every financial confirmation uses a stored expiring proposal and a client operation ID persisted before sending. Identical retries recover the original receipt; changed requests cannot reuse an operation. Corrections atomically append linked reversal/replacement events. Only the latest eligible transaction can be corrected. A dropped response stays "unknown" until receipt lookup or retry resolves it.

The authoritative database is `data/bol.sqlite`, automatically created by Node's bundled SQLite engine. Node 22 emits an experimental API warning. Refresh/server restart preserve the file. Stop the server before backing it up. Model files, databases, `.venv`, credentials and caches are excluded from Git.

## Privacy and limitations

After the one-time download, local inference has no cloud dependency. Keep the Node server and Python worker available; stopping the local server prevents authoritative writes. No service worker, offline page reload, remote sync, public authentication or hosted deployment is provided. Audio is decoded in memory and discarded after processing; transcripts are not stored in the ledger. Manual drafts and pending operation IDs use browser local storage. Recording caps at 20 seconds; the local decoder also rejects overlong decoded audio.

Whisper base can mishear Hindi, names, mixed-language speech and noisy audio. Human Hindi recordings, physical Android Chrome, street noise and actual OS microphone permission prompts remain unverified. Real local inference was verified with one synthetic English sample; the rule parser has a separate 26-case typed regression set. The interface is English-first with Hindi cues and Devanagari fallback fonts. It is a single-computer demo without bank/UPI/WhatsApp integrations. Public deployment still needs authentication, isolated shops, TLS and durable storage.

## Repository and documents

[Source repository](https://github.com/SkaaBroach853/BOL)

- [Architecture](docs/ARCHITECTURE.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Submission outline](docs/SUBMISSION_OUTLINE.md)
- [Verification](docs/VERIFICATION.md)
- [AI / resource disclosure](docs/AI_USAGE.md)
