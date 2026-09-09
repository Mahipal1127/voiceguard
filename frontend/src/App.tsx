import { useCallback, useEffect, useState } from "react";
import BuildRoadmap from "./components/BuildRoadmap";
import { checkHealth, type HealthResponse } from "./api/client";

type BackendStatus = "checking" | "online" | "offline";

const STATUS_STYLES: Record<BackendStatus, { dot: string; text: string; label: string }> = {
  checking: { dot: "bg-amber-400 animate-pulse", text: "text-amber-300", label: "Checking backend…" },
  online: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Backend online" },
  offline: { dot: "bg-rose-500", text: "text-rose-300", label: "Backend unreachable" },
};

export default function App() {
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
    <div className="min-h-screen bg-ink-950 text-slate-200 selection:bg-emerald-400/20">
      {/* Faint engineering-grid texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/10 ring-1 ring-emerald-400/30">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l2 2 3.5-4" />
              </svg>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold tracking-[0.25em] text-emerald-300">VOICEGUARD</p>
              <p className="text-xs text-slate-500">AI voice-clone impersonation shield · Team TRUETONE · SIH</p>
            </div>
          </div>
          <button
            onClick={() => void runHealthCheck()}
            className="rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
          >
            Recheck
          </button>
        </header>

        <main className="flex flex-1 flex-col justify-center gap-10 py-12">
          {/* Hero */}
          <section>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
              Local analysis · No cloud APIs
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
              Know who is really <span className="text-emerald-300">on the call.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
              VOICEGUARD checks a voice clip across three signals — speaker identity match, AI-voice
              likelihood and suspicious-request language — and returns one explainable risk score with
              an ALLOW / WARN / VERIFY / BLOCK decision.
            </p>
          </section>

          {/* Backend status card (Phase 1 checkpoint) */}
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
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Phase 1 checkpoint — this page (Vite · React · TypeScript · Tailwind) successfully calls
              the FastAPI <code className="text-slate-400">/health</code> endpoint. Pipeline screens
              land from Phase 2 onward.
            </p>
          </section>

          <BuildRoadmap />
        </main>

        <footer className="border-t border-ink-700 pt-4">
          <p className="font-mono text-[11px] leading-relaxed text-slate-600">
            Prototype — all processing stays on this machine. Decision thresholds (fixed):
            0–29 ALLOW · 30–59 WARN · 60–79 VERIFY · 80–100 BLOCK. Decision support, not proof —
            no detection method is 100% accurate.
          </p>
        </footer>
      </div>
    </div>
  );
}
