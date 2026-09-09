/** Live mic-capture widget (MediaRecorder + Web Audio level meter).
 * Policy: auto-stops at 30 s; 10-30 s is the recommended range — shorter
 * clips are handed back with a soft warning, not blocked.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SECONDS = 30;
const MIN_RECOMMENDED_SECONDS = 10;

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

function extensionFor(mime: string | undefined): string {
  if (!mime) return ".webm";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("mp4")) return ".m4a";
  if (mime.includes("mpeg")) return ".mp3";
  return ".webm";
}

function formatMs(ms: number): string {
  const s = ms / 1000;
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const tenths = Math.floor((s % 1) * 10);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${tenths}`;
}

interface AudioRecorderProps {
  onRecorded: (file: File, warning: string | null) => void;
  onDiscard?: () => void;
}

export default function AudioRecorder({ onRecorded, onDiscard }: AudioRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "review">("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const finalMsRef = useRef(0);
  const mimeRef = useRef<string | undefined>(undefined);
  const prevUrlRef = useRef<string | null>(null);
  const onRecordedRef = useRef(onRecorded);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const cleanupAudioGraph = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") void audioCtxRef.current.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => cleanupAudioGraph(), [cleanupAudioGraph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(148,163,184,0.2)";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const bars = 64;
    const step = Math.floor(data.length / bars);
    const bw = w / bars;
    ctx.fillStyle = "rgba(52,211,153,0.9)";
    for (let i = 0; i < bars; i++) {
      let peak = 0;
      for (let j = 0; j < step; j++) {
        const v = Math.abs(data[i * step + j] - 128) / 128;
        if (v > peak) peak = v;
      }
      const bh = Math.max(2, peak * (h - 6));
      ctx.fillRect(i * bw + 1, (h - bh) / 2, Math.max(1, bw - 2), bh);
    }
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const stop = useCallback(() => {
    finalMsRef.current = performance.now() - startedAtRef.current;
    setElapsedMs(finalMsRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    cleanupAudioGraph();
  }, [cleanupAudioGraph]);

  const start = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const mime = pickMimeType();
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const seconds = finalMsRef.current / 1000;
        const blob = new Blob(chunksRef.current, { type: mimeRef.current ?? "audio/webm" });
        const file = new File([blob], `voiceguard-recording${extensionFor(mimeRef.current)}`, { type: blob.type });
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = URL.createObjectURL(blob);
        setPreviewUrl(prevUrlRef.current);
        setState("review");
        const warning =
          seconds < MIN_RECOMMENDED_SECONDS
            ? `Clip is ${seconds.toFixed(1)} s — 10-30 s recommended for reliable analysis.`
            : null;
        onRecordedRef.current(file, warning);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      startedAtRef.current = performance.now();
      setElapsedMs(0);
      setState("recording");
      rafRef.current = requestAnimationFrame(draw);
    } catch (err) {
      setMicError(err instanceof Error ? `Microphone unavailable: ${err.message}` : "Microphone unavailable.");
      cleanupAudioGraph();
      setState("idle");
    }
  }, [draw, cleanupAudioGraph]);

  useEffect(() => {
    if (state !== "recording") return;
    const id = window.setInterval(() => {
      const ms = performance.now() - startedAtRef.current;
      setElapsedMs(ms);
      if (ms >= MAX_SECONDS * 1000) stop();
    }, 100);
    return () => window.clearInterval(id);
  }, [state, stop]);

  const discard = useCallback(() => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    setPreviewUrl(null);
    setElapsedMs(0);
    setState("idle");
    onDiscard?.();
  }, [onDiscard]);

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Live microphone</h3>
        {state === "recording" && (
          <span className="flex items-center gap-2 font-mono text-xs text-rose-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> REC
          </span>
        )}
      </div>

      {state === "idle" && (
        <div className="mt-6 flex flex-col items-center gap-4">
          <button
            onClick={() => void start()}
            className="rounded-lg bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30 transition-colors hover:bg-emerald-400/20"
          >
            ● Start recording
          </button>
          <p className="font-mono text-[11px] text-slate-500">10-30 s recommended · auto-stops at 30 s</p>
        </div>
      )}

      {state === "recording" && (
        <div className="mt-5 space-y-4">
          <p className="text-center font-mono text-3xl text-slate-100">
            {formatMs(elapsedMs)}
            <span className="text-sm text-slate-500"> / 00:30.0</span>
          </p>
          <canvas ref={canvasRef} width={640} height={80} className="h-20 w-full rounded-lg border border-ink-700 bg-ink-950" />
          <div className="flex justify-center">
            <button
              onClick={stop}
              className="rounded-lg bg-rose-500/10 px-6 py-2.5 text-sm font-semibold text-rose-300 ring-1 ring-rose-400/30 transition-colors hover:bg-rose-500/20"
            >
              ■ Stop
            </button>
          </div>
        </div>
      )}

      {state === "review" && previewUrl && (
        <div className="mt-5 space-y-4">
          <audio controls src={previewUrl} className="w-full" />
          <div className="flex justify-end">
            <button
              onClick={discard}
              className="rounded-md border border-ink-600 px-3 py-1.5 font-mono text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              Discard &amp; re-record
            </button>
          </div>
        </div>
      )}

      {micError && <p className="mt-4 rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{micError}</p>}
    </div>
  );
}
