/** Phase 4 — register a reference voice for speaker matching. */

import { useCallback, useEffect, useRef, useState } from "react";
import AudioRecorder from "../components/AudioRecorder";
import { enrollVoice, listEnrolled, type EnrolledVoice, type EnrollResponse } from "../api/client";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXT = [".wav", ".mp3", ".webm", ".ogg", ".m4a", ".flac"];

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`;
}

export default function EnrollPage() {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<EnrollResponse | null>(null);
  const [enrolled, setEnrolled] = useState<EnrolledVoice[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEnrolled(await listEnrolled());
    } catch {
      /* backend offline — the banner below still works once it is up */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    setDone(null);
  }, []);

  const enroll = useCallback(async () => {
    if (!name.trim() || !file || busy) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await enrollVoice(name.trim(), file));
      setFile(null);
      setName("");
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment request failed.");
    } finally {
      setBusy(false);
    }
  }, [name, file, busy, refresh]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Enroll a reference voice</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Register the voice of a person you trust (10-30 s of natural speech). Later analyses are
          compared against it — a high match means the caller sounds like this person.
        </p>
      </section>

      <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
        <label htmlFor="enroll-name" className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">
          Display name
        </label>
        <input
          id="enroll-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Mom, Dad, Manager"
          className="mt-3 w-full rounded-lg border border-ink-600 bg-ink-950 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-400/40 focus:outline-none"
        />
      </section>

      <AudioRecorder onRecorded={setFile} onDiscard={() => setFile(null)} />

      <div className="rounded-xl border border-dashed border-ink-600 bg-ink-900/40 p-5 text-center">
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
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-ink-600 bg-ink-800 px-4 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
        >
          {file ? `Selected: ${file.name} (${formatBytes(file.size)}) — change` : "…or upload an audio file"}
        </button>
      </div>

      {warning && <p className="rounded-lg bg-amber-400/10 px-4 py-3 text-xs text-amber-300 ring-1 ring-amber-400/20">{warning}</p>}
      {error && <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-xs text-rose-300 ring-1 ring-rose-400/20">{error}</p>}
      {done && (
        <p className="rounded-lg bg-emerald-400/10 px-4 py-3 text-xs text-emerald-300 ring-1 ring-emerald-400/20">
          {done.message} ({done.dimensions}-dim embedding stored)
        </p>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => void enroll()}
          disabled={!name.trim() || !file || busy}
          className="rounded-lg bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Extracting embedding…" : "Enroll reference voice"}
        </button>
      </div>

      {enrolled.length > 0 && (
        <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Enrolled voices</p>
          <ul className="mt-4 space-y-2">
            {enrolled.map((v) => (
              <li key={v.id} className="flex items-center justify-between border-b border-ink-700 pb-2 last:border-0 last:pb-0">
                <span className="text-sm text-slate-300">{v.name}</span>
                <span className="font-mono text-xs text-slate-600">{v.created_at}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
