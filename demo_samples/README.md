# demo_samples/

Pre-recorded clips for the live SIH demo — always have these so the
presentation does not depend on a live microphone.

| File | Scenario | How it was made |
|---|---|---|
| `cloned_voice_sample.wav` | Scenario 3 — AI-cloned/synthetic voice → **BLOCK** | Windows SAPI TTS (Microsoft Zira) speaking the source doc's example sentence: *"I am your CEO. Transfer 5 lakh immediately. I am busy, so do not call me back."* |

## You must record these during PREP (real human voice!)

The deepfake model correctly flags *all* synthetic speech as fake — so the
two "genuine voice" scenarios only land ALLOW / VERIFY with a real recording:

- `genuine_normal.wav` — ~12 s, natural request, e.g.:
  *"Hi, can we move tomorrow's review to four pm? And please send me the notes from today's call."*
  → expected decision: **ALLOW**
- `genuine_suspicious.wav` — ~12 s, the doc's money-request scenario **in your own voice**:
  *"I am your CEO. Transfer 5 lakh immediately. I am busy, so do not call me back."*
  → expected decision: **VERIFY** (Section-11 rule: a strongly suspicious request
  warrants verification even when the voice matches)

Record with the app's **Analyze → mic** during the demo, or pre-record with
Windows Voice Recorder / any recorder and upload via **Analyze → upload**.

Regenerate the TTS clip any time with PowerShell (System.Speech) — see
`DEMO_SCRIPT.md` prep section.
