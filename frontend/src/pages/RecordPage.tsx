/** Phase 2 — capture (mic) or upload a clip, then send it to POST /analyze. */

import { useCallback, useEffect, useRef, useState } from "react";
import AudioRecorder from "../components/AudioRecorder";
import { analyzeAudio, type AnalyzeResponse } from "../api/client";
import { Banner, Card, PrimaryButton, SecondaryButton, SectionLabel, Spinner } from "../components/ui";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXT = [".wav", ".mp3", ".webm", ".ogg", ".m4a", ".flac"];

// Honest progress guide: the pipeline runs server-side in one request; these
// are the real stages. `target` is the cumulative percent shown when the
// stage begins — an indeterminate walk that always looks like progress.
const STAGES: { label: string; target: number }[] = [
  { label: "Uploading audio", target: 10 },
  { label: "Transcribing speech (faster-whisper)", target: 40 },
  { label: "Matching speaker voiceprint (ECAPA-TDNN)", target: 60 },
  { label: "Scoring AI-voice likelihood (wav2vec2)", target: 82 },
  { label: "Checking request language", target: 92 },
  { label: "Combining the risk score", target: 97 },
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
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // elapsed — one timer for the whole request
  useEffect(() => {
    if (!busy) {
      setStageIdx(0);
      setElapsed(0);
      setProgress(0);
      return;
    }
    startedRef.current = performance.now();
    const tick = window.setInterval(
      () => setElapsed((performance.now() - startedRef.current) / 1000),
      100,
    );
    return () => window.clearInterval(tick);
  }, [busy]);

  // stage walk — advances on a schedule, stops at the last stage until done
  useEffect(() => {
    if (!busy) return;
    const stageId = window.setInterval(
      () => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)),
      1500,
    );
    return () => window.clearInterval(stageId);
  }, [busy]);

  // progress — jumps to the stage target, then creeps so the bar always moves
  useEffect(() => {
    if (!busy) return;
    setProgress((p) => Math.max(p, STAGES[stageIdx].target - 3));
    const creep = window.setInterval(() => {
      setProgress((p) => (p < STAGES[stageIdx].target ? Math.min(STAGES[stageIdx].target, p + 0.3) : p));
    }, 100);
    return () => window.clearInterval(creep);
  }, [busy, stageIdx]);

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
        <Card className="overflow-hidden">
          {/* header strip */}
          <div className="flex items-center justify-between border-b border-line bg-surface2/60 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <Spinner className="h-4 w-4 text-accent" />
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Analyzing</p>
            </div>
            <p className="font-mono text-xs text-fg">{elapsed.toFixed(1)}s</p>
          </div>

          {/* progress */}
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium text-fg">{STAGES[stageIdx].label}</p>
              <p className="font-mono text-xs text-muted">{Math.round(progress)}%</p>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* stage checklist */}
            <ol className="mt-4 space-y-2.5">
              {STAGES.map((s, i) => {
                const state = i < stageIdx ? "done" : i === stageIdx ? "active" : "pending";
                return (
                  <li key={s.label} className="flex items-center gap-2.5 text-xs">
                    {state === "done" ? (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-ok" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : state === "active" ? (
                      <Spinner className="h-3.5 w-3.5 shrink-0 text-accent" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-line2" />
                    )}
                    <span
                      className={
                        state === "pending" ? "text-faint" : state === "active" ? "font-medium text-fg" : "text-muted"
                      }
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            {elapsed > 25 && (
              <p className="mt-3 text-[11px] leading-relaxed text-faint">
                still working — models reload after a backend restart, so the first run can take up
                to a minute
              </p>
            )}
          </div>

          {/* footer strip */}
          <div className="border-t border-line bg-surface2/60 px-5 py-2.5">
            <p className="font-mono text-[10px] text-faint">
              one server request end-to-end · stages are a progress guide, not separate calls
            </p>
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
