import { useEffect, useState, type ReactNode } from "react";
import OverviewPage from "./pages/OverviewPage";
import RecordPage from "./pages/RecordPage";
import ResultPage from "./pages/ResultPage";
import EnrollPage from "./pages/EnrollPage";
import type { AnalyzeResponse } from "./api/client";

type View = "overview" | "analyze" | "enroll" | "result";
type Theme = "light" | "dark";

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
        active ? "bg-accent/10 text-accent" : "text-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-accent/40 hover:text-accent"
    >
      {theme === "light" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
        </svg>
      )}
    </button>
  );
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  // Default theme is LIGHT (product spec); the choice persists per browser.
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("voiceguard-theme") === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("voiceguard-theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-bg text-fg selection:bg-accent/20">
      {/* Subtle engineering-grid texture, theme-aware */}
      <div aria-hidden className="bg-grid pointer-events-none fixed inset-0" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          <button onClick={() => setView("overview")} className="flex items-center gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/30">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l2 2 3.5-4" />
              </svg>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold tracking-[0.25em] text-accent">VOICEGUARD</p>
              <p className="text-xs text-muted">AI voice-clone impersonation shield · Team TRUETONE · SIH</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
              <NavButton active={view === "overview"} onClick={() => setView("overview")}>
                Overview
              </NavButton>
              <NavButton active={view === "analyze" || view === "result"} onClick={() => setView("analyze")}>
                Analyze
              </NavButton>
              <NavButton active={view === "enroll"} onClick={() => setView("enroll")}>
                Enroll
              </NavButton>
            </nav>
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === "light" ? "dark" : "light")} />
          </div>
        </header>

        <main key={view} className="flex-1 py-8 sm:py-10 animate-fade-up">
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
          {view === "enroll" && <EnrollPage />}
        </main>

        <footer className="border-t border-line pt-4">
          <p className="font-mono text-[11px] leading-relaxed text-faint">
            Prototype — all processing stays on this machine. Decision thresholds (fixed):
            0–29 ALLOW · 30–59 WARN · 60–79 VERIFY · 80–100 BLOCK. Decision support, not proof — no
            detection method is 100% accurate.
          </p>
        </footer>
      </div>
    </div>
  );
}
