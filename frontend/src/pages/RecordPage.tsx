/** Phase 2 — capture (mic) or upload a clip, then send it to POST /analyze. */

import { useCallback, useRef, useState } from "react";
import AudioRecorder from "../components/AudioRecorder";
import { analyzeAudio, type AnalyzeResponse } from "../api/client";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXT = [".wav", ".mp3", ".webm", ".ogg", ".m4a", ".flac"];

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
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      setError(err instanceof Error ? err.message : "Analysis request failed.");
    } finally {
      setBusy(false);
    }
  }, [file, busy, onAnalyzed]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Analyze a voice clip</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Record 10-30 seconds with your microphone or upload a clip. The pipeline result appears on
          the next screen — ML signals land in Phases 3-7.
        </p>
      </section>

      <AudioRecorder onRecorded={setFile} onDiscard={() => setFile(null)} />

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-ink-700" />
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-600">or upload</span>
        <div className="h-px flex-1 bg-ink-700" />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-emerald-400/50 bg-emerald-400/5" : "border-ink-600 bg-ink-900/40"
        }`}
      >
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
        {file ? (
          <div className="space-y-1">
            <p className="text-sm text-slate-200">{file.name}</p>
            <p className="font-mono text-xs text-slate-500">{formatBytes(file.size)}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Drag a .wav / .mp3 / .webm clip here</p>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-md border border-ink-600 bg-ink-800 px-4 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
        >
          {file ? "Choose another file" : "Browse files"}
        </button>
      </div>

      {warning && (
        <p className="rounded-lg bg-amber-400/10 px-4 py-3 text-xs text-amber-300 ring-1 ring-amber-400/20">{warning}</p>
      )}
      {error && (
        <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-xs text-rose-300 ring-1 ring-rose-400/20">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => void analyze()}
          disabled={!file || busy}
          className="rounded-lg bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Analyzing…" : "Analyze clip →"}
        </button>
      </div>
    </div>
  );
}
