# AI and resource disclosure

Codex implemented this application, local agent code, tests, interface review and documents from the supplied handoff. The owner later requested a change from cloud APIs to local inference; that request supersedes the handoff's suggested cloud adapter. No human user research or invented commit history is claimed. No sub-agents were used during development.

Runtime uses an open pretrained Whisper base model through faster-whisper, CTranslate2 and PyAV, running on this computer. Whisper weights were originally released by OpenAI and converted by Systran; using these open weights locally does not call the OpenAI API. BOL did not train a speech model from scratch. Speech-model/library licenses and attribution must be preserved when redistributing weights. The model card identifies MIT; faster-whisper and CTranslate2 use their published licenses. The model is downloaded at setup and is not committed.

Interpretation/review agents are BOL's deterministic rule-based application code, not a general-purpose or trained LLM. Their authored 26-case regression set is not an independent recognition benchmark. The real inference smoke test uses offline Windows system TTS English audio, explicitly synthetic, not a human Hindi recording.

Other resources: React, Express, Vite, TypeScript, Zod, dotenv, tsx, Lucide icons, Node/SQLite, Playwright and axe, with exact npm versions in the lockfile. Python versions observed on this Windows machine are recorded in local-ai/requirements-lock-windows.txt; primary requirements pin the speech engine and compatible decoder. Fonts are native system/Devanagari fallbacks. Branding is application-native shapes and text; screenshots show the actual app, not image generation.

The Sites skill informed local UI review. Official OpenAI documentation informed the superseded cloud version; current local speech implementation uses the faster-whisper documentation and public model card. No application deployment or entry submission was made. Repository uploads were explicitly authorized by the owner.
