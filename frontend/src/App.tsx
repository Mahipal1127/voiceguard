import { useState, type ReactNode } from "react";
import OverviewPage from "./pages/OverviewPage";
import RecordPage from "./pages/RecordPage";
import ResultPage from "./pages/ResultPage";
import type { AnalyzeResponse } from "./api/client";

type View = "overview" | "analyze" | "result";

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
        active ? "bg-emerald-400/10 text-emerald-300" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

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
        <header className="flex items-center justify-between">
          <button onClick={() => setView("overview")} className="flex items-center gap-3 text-left">
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
          </button>
          <nav className="flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-900 p-1">
            <NavButton active={view === "overview"} onClick={() => setView("overview")}>
              Overview
            </NavButton>
            <NavButton active={view === "analyze" || view === "result"} onClick={() => setView("analyze")}>
              Analyze
            </NavButton>
            <span className="cursor-not-allowed rounded-md px-3 py-1.5 font-mono text-xs text-slate-600">
              Enroll · Phase 4
            </span>
          </nav>
        </header>

        <main className="flex-1 py-10">
          {view === "overview" && <OverviewPage onOpenAnalyzer={() => setView("analyze")} />}
          {view === "analyze" && (
            <RecordPage
              onAnalyzed={(r) => {
                setResult(r);
                setView("result");
              }}
            />
          )}
          {view === "result" && <ResultPage result={result} onNewAnalysis={() => setView("analyze")} />}
        </main>

        <footer className="border-t border-ink-700 pt-4">
          <p className="font-mono text-[11px] leading-relaxed text-slate-600">
            Prototype — all processing stays on this machine. Decision thresholds (fixed):
            0–29 ALLOW · 30–59 WARN · 60–79 VERIFY · 80–100 BLOCK. Decision support, not proof — no
            detection method is 100% accurate.
          </p>
        </footer>
      </div>
    </div>
  );
}
