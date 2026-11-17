# BOL - your local voice ledger

BOL now runs its speech model, interpretation agents, customer clarification and financial ledger on your own computer. **No cloud AI API, API key, subscription, or remote inference service.** The earlier cloud adapter was removed at the owner's request.

The interface has a forest-and-ivory voice studio, a contour orb driven by actual microphone samples, visible processing stages, mobile navigation, confirmation previews, immutable correction history, receipts, CSV export and a pending-payments dashboard.

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
npm run test:voice-ui
```

The first three check domain/API behavior, strict TypeScript/build, and the real Edge interface. Browser tests use port 3101 and a separate SQLite database; they deliberately disable speech to test the missing-model state and recording error handling. Keep 3101 free. Edge is the default; Playwright Chromium can be selected with `BOL_BROWSER_CHANNEL=chromium` after installing it.

`test:local` additionally checks **actual CPU speech inference through HTTP upload, local agents, preview, and explicit ledger confirmation**. It uses a synthetic English WAV saying "Suresh credit forty rupees." in an in-memory test shop. On Windows it can generate the WAV with offline system TTS. This is a synthetic regression sample, not human Hindi recognition evidence. The audio stays under ignored `data/` and is not uploaded to a service.

See [current evidence](docs/VERIFICATION.md) and [local inference observation](docs/local-speech-verification.json). A real local run recognized `Suresh Credit 40 Rupees.` and proposed ADD_CREDIT / 4000 paise. Small sample: no broad accuracy claim.

## Everyday Hindi and Hinglish

These instructions go through the local parser, customer resolution and a visible preview:

| Instruction | Result |
|---|---|
| `ramesh 100 ruppes add kardo` | Add ₹100 credit; choose which Ramesh if names are duplicated. |
| `meena ne 200 dediye mujhe batao kitna bacha hai` | Preview ₹200 repayment with the remaining balance; confirmation saves it. |
| `ramesh ne 50 ruppes diya` | Preview ₹50 repayment; duplicate identity must be resolved. |
| `meena ke kaathe me 300 jama kardo` | Preview ₹300 repayment, explicitly reducing outstanding; overpayment is rejected. |
| `meena ke isme 500 rupay udhar hai` | Ask whether this is new credit or a statement of existing debt. Never overwrite or silently double an existing balance. |

Common English/Hindi number words and compound amounts such as `do sau`, `teen sau`, `do hazaar teen sau` and `five hundred twenty five` are supported. Multiple amounts, multiple customers and conflicting directions require clarification. This is authored local language logic, not a newly trained universal model. Unsupported wording can still require the form or an edited transcript.

## Voice conversation

Start with the microphone. Real audio levels drive the orb; once speech is detected, a pause of about 1.8 seconds stops the recording. The 20-second limit and explicit stop/cancel buttons remain. Local transcription happens after recording stops, rather than streaming partial text.

With **Voice conversation** enabled, a voice-generated preview opens a separate follow-up microphone for up to eight seconds. Say `sahi hai confirm`, `sahi hai to confirm`, `haan sahi hai`, or `confirm` to approve that visible proposal; say `phir se suno`, `phir se sunno`, or `listen again` to discard the preview and record the full entry again. `cancel` cancels. Unknown/negative phrases do not approve. No detected speech means no confirmation request is interpreted. The original confirmation button always remains available.

After a voice-confirmed receipt, the next entry starts after 3.5 seconds while the Home tab remains visible. Turn off Voice conversation to stop this loop and use tap confirmation. Leaving the page or hiding the browser tab stops active capture. A spoken phrase can still be misrecognized by the speech model; this feature does not guarantee financial recognition accuracy.

`npm run test:voice-ui` exercises real browser recording, real local transcription, spoken retry, a repeated credit and spoken confirmation, using four synthetic English WAV clips from Windows offline TTS. It uses an isolated in-memory shop and never calls a mocked transcription endpoint. On Windows systems without an available system voice, provide the three WAV files listed in the script or run the generator from a normal PowerShell session. This does not replace a human Hindi microphone test.

## Offline entries and synchronization

After one online visit, the production build caches its application shell and latest ledger snapshot. If the local server becomes unreachable, manual entries can be **Saved on this device** in IndexedDB and survive an offline page reload. They are labeled **Awaiting ledger sync** and are excluded from confirmed balances. Storage failures are surfaced, never represented as successful saves.

When connected again, use **Review & sync**. BOL checks the original operation ID for an existing receipt, revalidates the entry against current server data and shows a new preview. Explicit confirmation commits it to SQLite exactly once, then removes the local draft. Reconnection does not silently commit unreviewed money. Archived-shop drafts cannot sync into a different shop. This is browser-to-local-server synchronization, not cloud or multi-device sync. Clearing site data removes unsynchronized drafts; keep the same URL/port for the browser's storage.

External internet can be disconnected while the installed local server and speech model keep working. Browser-wide offline mode also blocks localhost and exercises the separate queued-draft path. Voice transcription requires the local worker; a disconnected browser uses manual entry.

## Pending payments and WhatsApp

Open **Dashboard** to see customers with a positive confirmed balance, the amount due, latest entry date and saved phone number. Add a number there or when creating a customer. Indian 10-digit mobile numbers gain `91`; other numbers require their international country code. Contacts persist in SQLite, including existing databases through a non-destructive phone-column migration.

**Remind** opens a real [WhatsApp click-to-chat link](https://faq.whatsapp.com/5913398998672934) with the current balance and a prepared message. You review and send in WhatsApp. No API credentials are needed for this handoff; an active WhatsApp account and internet are needed to send. The application does not automatically send messages, track delivery or claim a message was delivered.

## Financial correctness and persistence

Money uses integer paise, exact decimal-string parsing, positive amounts, two-decimal precision and a configurable default 10,000-rupee entry limit. Repayment above current outstanding is rejected. Balances are derived from immutable ledger events, never model output.

Every financial confirmation uses a stored expiring proposal and a client operation ID persisted before sending. Identical retries recover the original receipt; changed requests cannot reuse an operation. Corrections atomically append linked reversal/replacement events. Only the latest eligible transaction can be corrected. A dropped response stays "unknown" until receipt lookup or retry resolves it.

The authoritative database is `data/bol.sqlite`, automatically created by Node's bundled SQLite engine. Node 22 emits an experimental API warning. Refresh/server restart preserve the file. Stop the server before backing it up. Model files, databases, `.venv`, credentials and caches are excluded from Git.

## Privacy and limitations

After the one-time download, local inference has no cloud dependency. Keep the Node server and Python worker available for voice and authoritative writes. The service worker caches the shell, local storage caches the snapshot/draft/pending operation IDs, and IndexedDB stores disconnected manual entries. Audio is decoded in memory and discarded after processing; transcripts are not stored in the ledger. Phone numbers are local customer metadata. Recording caps at 20 seconds; the local decoder also rejects overlong decoded audio. No cloud sync, public authentication or hosted deployment is provided.

Whisper base can mishear Hindi, names, mixed-language speech and noisy audio. Human Hindi recordings, physical Android Chrome, street noise and actual OS microphone permission prompts remain unverified. Synthetic English audio and typed parser tests are separate evidence; neither establishes universal accuracy. The interface is English-first with Hindi cues and Devanagari fallback fonts. It is a single-computer prototype without bank/UPI execution or automated WhatsApp delivery. Public deployment still needs authentication, isolated shops, TLS and durable storage.

## Repository and documents

[Source repository](https://github.com/SkaaBroach853/BOL)

- [Architecture](docs/ARCHITECTURE.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Submission outline](docs/SUBMISSION_OUTLINE.md)
- [Verification](docs/VERIFICATION.md)
- [AI / resource disclosure](docs/AI_USAGE.md)






