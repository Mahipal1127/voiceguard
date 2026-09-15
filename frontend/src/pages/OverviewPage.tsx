/** Overview — product landing for judges: value prop, how it works, live status. */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import BuildRoadmap from "../components/BuildRoadmap";
import { checkHealth, type HealthResponse } from "../api/client";
import { Card, PrimaryButton, SectionLabel } from "../components/ui";

type BackendStatus = "checking" | "online" | "offline";

const STATUS_STYLES: Record<BackendStatus, { dot: string; text: string; label: string }> = {
  checking: { dot: "bg-amber-400 animate-pulse", text: "text-amber-300", label: "Checking backend…" },
  online: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Backend online" },
  offline: { dot: "bg-rose-500", text: "text-rose-300", label: "Backend unreachable" },
};

const SIGNALS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Speaker match",
    body: "The caller's voiceprint is compared against enrolled trusted voices (ECAPA-TDNN).",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    ),
  },
  {
    title: "AI-voice risk",
    body: "A wav2vec2 deepfake classifier scores synthetic audio, with a transparent signal heuristic alongside.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-rose-300" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" d="M3 12h2l2-5 3 10 3-14 3 12 2-3h3" />
      </svg>
    ),
  },
  {
    title: "Behavior analysis",
    body: "The transcript is scanned for money-transfer, urgency, authority and OTP language — every flag ships with its receipt.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l9 16H3l9-16zM12 10v4M12 17.5v.5" />
      </svg>
    ),
  },
];

const DECISIONS = [
  { label: "ALLOW", range: "0-29", cls: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30" },
  { label: "WARN", range: "30-59", cls: "bg-amber-400/10 text-amber-300 ring-amber-400/30" },
  { label: "VERIFY", range: "60-79", cls: "bg-orange-400/10 text-orange-300 ring-orange-400/30" },
  { label: "BLOCK", range: "80-100", cls: "bg-rose-500/10 text-rose-300 ring-rose-400/30" },
];

interface OverviewPageProps {
  onOpenAnalyzer: () => void;
}

export default function OverviewPage({ onOpenAnalyzer }: OverviewPageProps) {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const runHealthCheck = useCallback(async () => {
    setStatus("checking");
    const started = performance.now();
    try {
      setHealth(await checkHealth());
      setLatencyMs(Math.round(performance.now() - started));
      setStatus("online");
    } catch {
      setHealth(null);
      setLatencyMs(null);
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    void runHealthCheck();
  }, [runHealthCheck]);

  const s = STATUS_STYLES[status];

  return (
    <div className="space-y-10">
      <section>
        <SectionLabel>Local analysis · No cloud APIs</SectionLabel>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
          Know who is really <span className="text-emerald-300">on the call.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
          Voice-clone fraud sounds exactly like someone you trust. VOICEGUARD checks a clip across
          three independent signals and returns one explainable risk score with a clear decision —
          computed entirely on this machine in a few seconds.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={onOpenAnalyzer}>Open the analyzer →</PrimaryButton>
          <span className="inline-flex items-center gap-2 rounded-full bg-ink-800 px-3 py-1.5 font-mono text-[11px] text-slate-400 ring-1 ring-ink-600">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5V11z" />
            </svg>
            audio never leaves this machine
          </span>
        </div>
      </section>

      <section>
        <SectionLabel>Three signals · one decision</SectionLabel>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {SIGNALS.map((sig) => (
            <Card key={sig.title} className="p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-800 ring-1 ring-ink-600">{sig.icon}</div>
              <p className="mt-3 text-sm font-semibold text-slate-100">{sig.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{sig.body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {DECISIONS.map((d) => (
            <span key={d.label} className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs ring-1 ${d.cls}`}>
              <span className="font-semibold">{d.label}</span>
              <span className="text-slate-400">{d.range}</span>
            </span>
          ))}
        </div>
      </section>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
            <p className={`font-mono text-sm ${s.text}`}>{s.label}</p>
          </div>
          <div className="font-mono text-xs text-slate-500">
            {health ? `v${health.version} · ${health.service}` : "no response"}
            {latencyMs !== null && status === "online" ? ` · ${latencyMs} ms` : ""}
          </div>
        </div>
      </Card>

      <div>
        <SectionLabel>Build status</SectionLabel>
        <div className="mt-3">
          <BuildRoadmap />
        </div>
      </div>
    </div>
  );
}
