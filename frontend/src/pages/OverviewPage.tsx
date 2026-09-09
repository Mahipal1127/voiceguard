/** Overview page — product intro, backend status and build roadmap. */

import { useCallback, useEffect, useState } from "react";
import BuildRoadmap from "../components/BuildRoadmap";
import { checkHealth, type HealthResponse } from "../api/client";

type BackendStatus = "checking" | "online" | "offline";

const STATUS_STYLES: Record<BackendStatus, { dot: string; text: string; label: string }> = {
  checking: { dot: "bg-amber-400 animate-pulse", text: "text-amber-300", label: "Checking backend…" },
  online: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Backend online" },
  offline: { dot: "bg-rose-500", text: "text-rose-300", label: "Backend unreachable" },
};

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
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Local analysis · No cloud APIs</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
          Know who is really <span className="text-emerald-300">on the call.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
          VOICEGUARD checks a voice clip across three signals — speaker identity match, AI-voice
          likelihood and suspicious-request language — and returns one explainable risk score with an
          ALLOW / WARN / VERIFY / BLOCK decision.
        </p>
        <button
          onClick={onOpenAnalyzer}
          className="mt-6 rounded-lg bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30 transition-colors hover:bg-emerald-400/20"
        >
          Open the analyzer →
        </button>
      </section>

      <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
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
      </section>

      <BuildRoadmap />
    </div>
  );
}
