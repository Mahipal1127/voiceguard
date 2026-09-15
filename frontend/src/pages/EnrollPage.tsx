/** Phase 4 — register a reference voice for speaker matching. */

import { useCallback, useEffect, useRef, useState } from "react";
import AudioRecorder from "../components/AudioRecorder";
import { enrollVoice, listEnrolled, type EnrolledVoice, type EnrollResponse } from "../api/client";
import { Banner, Card, PrimaryButton, SectionLabel } from "../components/ui";

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
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Enroll a reference voice</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Register the voice of a person you trust (10-30 s of natural speech). Later analyses are
          compared against it — a high match means the caller sounds like this person.
        </p>
      </section>

      <Card className="p-5 sm:p-6">
        <SectionLabel>1 · Display name</SectionLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Mom, Dad, Manager"
          className="mt-3 w-full rounded-lg border border-line bg-surface2/50 px-4 py-2.5 text-sm text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none"
        />
      </Card>

      <section>
        <SectionLabel>2 · Voice sample</SectionLabel>
        <div className="mt-3 space-y-4">
          <AudioRecorder onRecorded={setFile} onDiscard={() => setFile(null)} />

          <Card className="p-5 text-center">
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
            <p className="text-sm text-muted">
              {file ? (
                <>
                  <span className="font-medium text-fg">{file.name}</span>
                  <span className="ml-2 font-mono text-xs text-faint">{formatBytes(file.size)}</span>
                </>
              ) : (
                "…or upload an audio file"
              )}
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-lg border border-line2 px-4 py-1.5 font-mono text-xs text-muted transition hover:border-accent/40 hover:text-fg"
            >
              {file ? "Choose another file" : "Browse files"}
            </button>
          </Card>
        </div>
      </section>

      {warning && <Banner tone="warning">{warning}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {done && (
        <Banner tone="success">
          {done.message} ({done.dimensions}-dim embedding stored)
        </Banner>
      )}

      <PrimaryButton className="!w-full" onClick={() => void enroll()} disabled={!name.trim() || !file || busy}>
        {busy ? "Extracting embedding…" : "3 · Enroll reference voice"}
      </PrimaryButton>

      {enrolled.length > 0 && (
        <Card className="p-5 sm:p-6">
          <SectionLabel>Enrolled voices</SectionLabel>
          <ul className="mt-4 space-y-2">
            {enrolled.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between border-b border-line pb-2 last:border-0 last:pb-0"
              >
                <span className="text-sm text-fg">{v.name}</span>
                <span className="font-mono text-xs text-faint">{v.created_at}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
