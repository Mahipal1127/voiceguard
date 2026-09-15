/** Phase 2 — capture (mic) or upload a clip, then send it to POST /analyze. */

import { useCallback, useEffect, useRef, useState } from "react";
import AudioRecorder from "../components/AudioRecorder";
import { analyzeAudio, type AnalyzeResponse } from "../api/client";
import { Banner, Card, PrimaryButton, SecondaryButton, SectionLabel, Spinner } from "../components/ui";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXT = [".wav", ".mp3", ".webm", ".ogg", ".m4a", ".flac"];

// Honest progress guide: the pipeline runs server-side in one request; these
// are the real stages, shown as an indeterminate walkthrough while we wait.
const STAGES = [
  "Uploading audio…",
  "Transcribing speech (faster-whisper)…",
  "Matching speaker voiceprint (ECAPA-TDNN)…",
  "Scoring AI-voice likelihood (wav2vec2)…",
  "Checking request language…",
  "Combining the risk score…",
];

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`;
}

interface RecordPageProps {
  onAnalyzed: (result: AnalyzeResponse) => void;
}

export default function RecordPage({ onAnalyzed }: RecordPageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!busy) {
      setStageIdx(0);
      setElapsed(0);
      return;
    }
    const started = performance.now();
    const tick = window.setInterval(() => setElapsed((performance.now() - started) / 1000), 100);
    const stageId = window.setInterval(() => setStageIdx((i) => (i + 1) % STAGES.length), 1100);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(stageId);
    };
  }, [busy]);

  const acceptFile = useCallback((f: File) => {
    setError(null);
    setWarning(null);
    const lower = f.name.toLowerCase();
    const ok = ACCEPTED_EXT.some((ext) => lower.endsWith(ext)) || f.type.startsWith("audio/");
    if (!ok) {
      setError("Unsupported file type — use .wav, .mp3, .webm, .ogg, .m4a or .flac.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("File too large — 25 MB max.");
      return;
    }
    setFile(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) acceptFile(f);
    },
    [acceptFile],
  );

  const analyze = useCallback(async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      onAnalyzed(await analyzeAudio(file));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis request failed.";
      setError(
        /failed to fetch|networkerror|load failed/i.test(msg)
          ? "Cannot reach the backend — start it with scripts\\start_all.ps1, or check the deployed backend URL."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }, [file, busy, onAnalyzed]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Analyze a voice clip</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Record 10-30 seconds with your microphone or upload a clip. You'll get the transcript,
          three signal scores and an ALLOW / WARN / VERIFY / BLOCK decision.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <AudioRecorder onRecorded={setFile} onDiscard={() => setFile(null)} />

        <Card className="flex flex-col p-5 sm:p-6">
          <SectionLabel>Upload a file</SectionLabel>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`mt-4 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors ${
              dragOver ? "border-accent/60 bg-accent/5" : "border-line2 bg-surface2/50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-faint" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
            </svg>
            <p className="mt-3 text-sm text-muted">
              {file ? (
                <>
                  <span className="font-medium text-fg">{file.name}</span>
                  <span className="ml-2 font-mono text-xs text-faint">{formatBytes(file.size)}</span>
                </>
              ) : (
                "Drag a .wav / .mp3 / .webm clip here"
              )}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.webm,.ogg,.m4a,.flac"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) acceptFile(f);
                e.target.value = "";
              }}
            />
            <SecondaryButton className="mt-4" onClick={() => inputRef.current?.click()}>
              {file ? "Choose another file" : "Browse files"}
            </SecondaryButton>
          </div>
        </Card>
      </div>

      {warning && <Banner tone="warning">{warning}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {busy ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Spinner className="h-6 w-6 text-accent" />
            <div>
              <p className="font-mono text-sm text-accent">
                {STAGES[stageIdx]} <span className="text-muted">{elapsed.toFixed(1)} s</span>
              </p>
              <p className="mt-0.5 text-[11px] text-faint">
                {elapsed > 25
                  ? "still working — models reload after a backend restart, so the first run can take up to a minute"
                  : "the full pipeline runs server-side in a single request — stages are a guide, not steps"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-1">
            {STAGES.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= stageIdx ? "bg-accent/60" : "bg-line"}`} />
            ))}
          </div>
        </Card>
      ) : (
        <div className="flex justify-end">
          <PrimaryButton onClick={() => void analyze()} disabled={!file}>
            Analyze clip →
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
