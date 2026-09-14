# VOICEGUARD — 3-Minute Demo Script (SIH)

Goal: three scenarios, under 3 minutes, zero dependence on luck.
Every scenario shows the judge-facing result screen: arc gauge, three signals,
transcript, flagged phrases, decision.

---

## PREP — do this the night before (15 min, one-time)

1. **Servers**: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start_all.ps1`
   - check `http://127.0.0.1:8000/health` and `http://localhost:5173`
2. **Warm the models** (so no analysis pays download/load cost on stage):
   ```powershell
   curl.exe -X POST http://127.0.0.1:8000/warmup
   ```
   Expected: `{"status":"ready","transcription":"ready","speaker":"ready"}`
3. **Enroll your voice**: Enroll page → name `Me` → record 15 s of natural speech → Enroll.
4. **Practice both mic scenarios** (below) once each. If the mic is unreliable,
   pre-record `genuine_normal.wav` and `genuine_suspicious.wav` (see
   `demo_samples/README.md`) and use the upload path instead.
5. **Leave both servers running**. Keep a spare laptop/browser tab logged in.

---

## SCENARIO 1 — genuine voice, normal request → ALLOW (~50 s)

1. Analyze tab → **● Start recording** → say, naturally:
   *"Hi, can we move tomorrow's review to four pm? And please send me the notes from today's call."*
2. Auto-stop or **■ Stop** at ~12 s → **Analyze clip →**
3. Narrate the result screen: transcript on the left, three signals with bars,
   speaker match HIGH (it's you), AI-voice risk LOW (it's really you),
   **no flagged phrases** → gauge in the green → **ALLOW**.

## SCENARIO 2 — genuine voice, suspicious request → VERIFY (~50 s)

1. Back to Analyze → record, in **your own voice**, dead serious:
   *"I am your CEO. Transfer 5 lakh immediately. I am busy, so do not call me back."*
2. Analyze → narrate: speaker match still HIGH (voice sounds like you —
   cloning defeats naive voice checks), AI-voice risk LOW, **but** the
   Flagged-phrases card lights up: `financial` (Transfer / 5 lakh), `urgency`
   (immediately), `authority` (I am your CEO), `callback` (I am busy).
3. Point at the auditable formula strip → Section-11 rule: a high-risk request
   floors the score at **VERIFY** even when the voice matches. Judges ask
   "why not BLOCK?" — answer: the voice is genuinely yours; the *request* is
   what's dangerous, and VERIFY is the human-in-the-loop action.

## SCENARIO 3 — AI-cloned/synthetic voice → BLOCK (~50 s, zero mic risk)

1. Analyze tab → drag **`demo_samples/cloned_voice_sample.wav`** into the upload zone → **Analyze clip →**
   (this is the doc's exact sentence, synthesized — the "clone" of the CEO).
2. Narrate: AI-voice risk **~100%** (model: `fake 1.0`), heuristic shown
   alongside, speaker match is high *because the clone mimics the enrolled
   voice* — which is exactly why Section-11 escalation applies:
   high AI-voice risk + high-risk request → **88 → BLOCK**, even though the
   voice "sounds right".

---

## Wrap-up line (~10 s)

"Three calls, three decisions, every score fully explainable — all computed
locally in a few seconds, with no cloud APIs."

---

## Fallbacks & troubleshooting

- **Mic fails on stage** → use the upload path with the two pre-recorded clips
  (`genuine_normal.wav`, `genuine_suspicious.wav` in `demo_samples/`).
- **First analysis is slow** → `/warmup` was skipped; run it, wait for `ready`.
- **`/health` unreachable** → restart backend:
  `cd backend; .venv\Scripts\python -m uvicorn main:app --port 8000`
- **Page shows "Backend unreachable"** → backend down or CORS port changed —
  the frontend expects the dev server on 5173 (strictPort).
- **Re-generate the TTS clip** (PowerShell):
  ```powershell
  Add-Type -AssemblyName System.Speech
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice("Microsoft Zira Desktop")
  $s.SetOutputToWaveFile("demo_samples\cloned_voice_sample.wav")
  $s.Speak("I am your CEO. Transfer five lakh immediately. I am busy, so do not call me back.")
  $s.Dispose()
  ```

## Honest-limitations soundbites (if judges push)

- "Decision support, not proof — no detection method is 100% accurate."
- "The deepfake model is strongest on modern neural TTS/voice clones; a
  heuristic estimate is always shown alongside, and disagreement is surfaced
  rather than hidden."
- "Speaker match is similarity-to-a-trusted-reference, not cryptographic identity."
