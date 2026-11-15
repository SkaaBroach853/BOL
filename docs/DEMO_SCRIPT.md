# BOL · 2 minute 45 second demonstration

## Before recording

Run the production build, open localhost, zoom for legible amounts, and use a fresh shop via Settings → type `RESET DEMO`. The four sample customers start at zero. Test the microphone and real API credentials separately before claiming a voice demo. Use fictitious data only. Keep this script, not terminal keys, on screen. Do not expose `.env`.

**Current verified rehearsal is manual/typed. Real cloud voice is unverified because no key was available.** If a key is still absent, introduce the demonstration as the working manual/typed ledger with voice setup pending. Do not speak over manual actions and imply transcription occurred. If real voice fails, leave the error visible, explain it and use the form. Do not splice failures into apparent live successes.

## Timed run

| Time | Action and narration |
|---|---|
| 0:00–0:15 | “A busy tea-stall owner has to remember who owes what. BOL keeps the record clear: enter it, review it, confirm it.” Show the real empty sample shop and microphone/manual option. This is a scenario, not a testimonial. |
| 0:15–0:45 | With verified credentials, record: “Ramesh ke naam chalis rupaye udhaar likho.” Show the actual transcript. Two Ramesh customers exist: select Auto driver when asked. Review ₹40 credit; explicitly confirm and show the saved receipt. Without credentials, say “This is manual entry; live voice is awaiting setup,” and select Credit given → Ramesh · Auto driver → 40. |
| 0:45–1:10 | With voice verified, record: “Nahi, Ramesh nahi, Suresh.” Otherwise use Correct latest transaction. Select Suresh · Book shop, preview movement, confirm. Point out Ramesh's original event, linked reversal and Suresh's replacement. |
| 1:10–1:35 | Record “Suresh ne bees rupaye de diye,” or clearly use Repayment received → Suresh → 20. Show preview, confirm, and ₹20 outstanding. Never describe typed words as recognition evidence. |
| 1:35–1:55 | Type or record “Ramesh ko chalis rupaye udhaar likho.” Show the two labels, no balance change, and explicit identity selection. Cancel before saving this extra transaction. Optional ambiguous direction: “Ramesh ko chalis diye.” |
| 1:55–2:15 | For the actual local network rehearsal, disconnect external Wi-Fi/Ethernet while keeping localhost running. Demonstrate that manual previews still reach the local API, cancel that preview, and show cloud failure only if truly attempted. Reconnect. Do not use browser-wide Offline mode to claim external-only loss. If no physical disconnect was rehearsed, state the boundary as an unverified limitation instead of staging it. |
| 2:15–2:35 | Refresh. Show Suresh ₹20 and Ramesh ₹0, then Activity's four linked events. Briefly show the actual current verification report and tests, distinguishing mocks, typed cases, generated recorder audio, and real provider runs. |
| 2:35–2:45 | “This is a local Hindi/English prototype. The latest transaction can be corrected; older history is protected. Live speech remains [verified in this recording / unverified pending credentials].” Show real repository/demo links only if later published; otherwise clearly show LOCAL DEMO / NOT PUBLISHED. |

## Rehearsal checklist

- Confirm the central ₹40 → move → ₹20 path, receipt and refresh without edits.
- Capture clear audio, readable screen zoom and captions. Disclose cuts.
- Do not claim 100% recognition, user savings, noisy-street coverage, production readiness or unmeasured latency/cost.
- Record audio-stop-to-preview and confirm-to-receipt separately. For only a few observations, list raw timings, not broad percentile claims.
- Actual screenshots are in `screenshots/`; they came from the running browser, not image generation.
