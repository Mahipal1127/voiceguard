/** Result screen — gauge, signals, transcript, flagged phrases, decision. */

import type { AnalyzeResponse } from "../api/client";
import RiskGauge from "../components/RiskGauge";
import SignalBreakdown from "../components/SignalBreakdown";
import { Card, SecondaryButton, SectionLabel } from "../components/ui";

interface ResultPageProps {
  result: AnalyzeResponse | null;
  onNewAnalysis: () => void;
}

export default function ResultPage({ result, onNewAnalysis }: ResultPageProps) {
  if (!result) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-muted">No analysis yet — record or upload a clip first.</p>
        <SecondaryButton className="mt-4" onClick={onNewAnalysis}>
          Go to analyzer
        </SecondaryButton>
      </div>
    );
  }

  const duration = result.audio.duration_sec;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Analysis result</h1>
          <p className="mt-1 font-mono text-xs text-faint">
            analysis #{result.analysis_id ?? "?"} · {result.audio.filename}
            {duration !== null ? ` · ${duration.toFixed(1)} s` : ""}
            {result.cached ? " · ⚡ instant (cached — identical audio)" : ""}
          </p>
        </div>
        <SecondaryButton onClick={onNewAnalysis}>Analyze another clip</SecondaryButton>
      </section>

      <RiskGauge value={result.overall_risk_pct} decision={result.decision} components={result.risk_components} />

      <SignalBreakdown result={result} />

      <Card className="p-5 sm:p-6">
        <SectionLabel>Transcript</SectionLabel>
        <p
          className={`mt-3 border-l-2 pl-4 text-base leading-relaxed ${
            result.transcript ? "border-accent/40 text-fg" : "border-line text-faint"
          }`}
        >
          {result.transcript ?? "No speech detected in this clip."}
        </p>
        {result.language && (
          <p className="mt-3 font-mono text-[11px] text-faint">language: {result.language} · faster-whisper</p>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionLabel>Reasons</SectionLabel>
        <ul className="mt-3 space-y-2">
          {result.reasons.map((r) => (
            <li key={r} className="flex gap-2 text-sm text-muted">
              <span className="mt-0.5 text-accent">·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Card>

      {result.behavior && result.behavior.matched.length > 0 && (
        <Card className="p-5 sm:p-6">
          <SectionLabel>Flagged phrases — suspicious-request analysis</SectionLabel>
          <ul className="mt-4 space-y-3">
            {result.behavior.matched.map((m, i) => (
              <li key={`${m.category}-${i}`} className="rounded-lg border border-warn/25 bg-warn/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-warn">{m.category}</span>
                  <span className="font-mono text-xs text-fg">“{m.phrase}”</span>
                </div>
                <p className="mt-1 text-xs text-muted">…{m.context}…</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <details className="rounded-xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-mono text-xs text-muted transition-colors hover:text-fg">
          Raw API response
        </summary>
        <pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-faint">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}
