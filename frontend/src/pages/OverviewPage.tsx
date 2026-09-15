/** Overview — product landing: value prop, how it works, live status. */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import BuildRoadmap from "../components/BuildRoadmap";
import { checkHealth, type HealthResponse } from "../api/client";
import { Card, PrimaryButton, SectionLabel } from "../components/ui";

type BackendStatus = "checking" | "online" | "offline";

const STATUS_STYLES: Record<BackendStatus, { dot: string; text: string; label: string }> = {
  checking: { dot: "bg-warn animate-pulse", text: "text-warn", label: "Checking backend…" },
  online: { dot: "bg-ok", text: "text-ok", label: "Backend online" },
  offline: { dot: "bg-stop", text: "text-stop", label: "Backend unreachable" },
};

const SIGNALS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Speaker match",
    body: "The caller's voiceprint is compared against enrolled trusted voices (ECAPA-TDNN).",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    ),
  },
  {
    title: "AI-voice risk",
    body: "A wav2vec2 deepfake classifier scores synthetic audio, with a transparent signal heuristic alongside.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" d="M3 12h2l2-5 3 10 3-14 3 12 2-3h3" />
      </svg>
    ),
  },
  {
    title: "Behavior analysis",
    body: "The transcript is scanned for money-transfer, urgency, authority and OTP language — every flag ships with its receipt.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l9 16H3l9-16zM12 10v4M12 17.5v.5" />
      </svg>
    ),
  },
];

const DECISIONS = [
  { label: "ALLOW", range: "0-29", cls: "bg-ok/10 text-ok ring-ok/30" },
  { label: "WARN", range: "30-59", cls: "bg-warn/10 text-warn ring-warn/30" },
  { label: "VERIFY", range: "60-79", cls: "bg-check/10 text-check ring-check/30" },
  { label: "BLOCK", range: "80-100", cls: "bg-stop/10 text-stop ring-stop/30" },
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
        <SectionLabel>On-device fraud detection · No cloud · No recordings leave this machine</SectionLabel>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Know who is really <span className="text-accent">on the call.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Voice-clone fraud sounds exactly like someone you trust. Record or upload a clip —
          VOICEGUARD verifies the speaker, detects synthetic audio and flags social-engineering
          language, then hands you one clear decision you can act on.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={onOpenAnalyzer}>Start analyzing →</PrimaryButton>
          <span className="inline-flex items-center gap-2 rounded-full bg-surface2 px-3 py-1.5 font-mono text-[11px] text-muted ring-1 ring-line">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-ok" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5V11z" />
            </svg>
            audio never leaves this machine
          </span>
        </div>
      </section>

      <section>
        <SectionLabel>Three signals · one decision</SectionLabel>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {SIGNALS.map((sig, i) => (
            <Card key={sig.title} className="p-5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${
                  ["bg-ok/10 text-ok ring-ok/25", "bg-stop/10 text-stop ring-stop/25", "bg-warn/10 text-warn ring-warn/25"][i]
                }`}
              >
                {sig.icon}
              </div>
              <p className="mt-3 text-sm font-semibold text-fg">{sig.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{sig.body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {DECISIONS.map((d) => (
            <span key={d.label} className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs ring-1 ${d.cls}`}>
              <span className="font-semibold">{d.label}</span>
              <span className="opacity-70">{d.range}</span>
            </span>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>How it works</SectionLabel>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Card className="flex items-start gap-3 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-bold text-accent ring-1 ring-accent/25">
              1
            </span>
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-fg">Capture</span> — record 10-30 s from the mic or
              upload an existing clip.
            </p>
          </Card>
          <Card className="flex items-start gap-3 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-bold text-accent ring-1 ring-accent/25">
              2
            </span>
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-fg">Analyze</span> — three independent signals run
              in parallel, each with its own evidence.
            </p>
          </Card>
          <Card className="flex items-start gap-3 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-bold text-accent ring-1 ring-accent/25">
              3
            </span>
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-fg">Decide</span> — one auditable 0-100 score maps
              to ALLOW / WARN / VERIFY / BLOCK.
            </p>
          </Card>
        </div>
      </section>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
            <p className={`font-mono text-sm ${s.text}`}>{s.label}</p>
          </div>
          <div className="font-mono text-xs text-faint">
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
