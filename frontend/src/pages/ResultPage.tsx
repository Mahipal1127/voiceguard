/** Phase 2 — placeholder result view.
 * Honest by design: no scores are invented. Phase 8 replaces this with the
 * full judge-facing dashboard (RiskGauge, SignalBreakdown, transcript).
 */

import type { AnalyzeResponse } from "../api/client";
import RiskGauge from "../components/RiskGauge";
import SignalBreakdown from "../components/SignalBreakdown";

interface ResultPageProps {
  result: AnalyzeResponse | null;
  onNewAnalysis: () => void;
}

export default function ResultPage({ result, onNewAnalysis }: ResultPageProps) {
  if (!result) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-slate-400">No analysis yet — record or upload a clip first.</p>
        <button
          onClick={onNewAnalysis}
          className="mt-4 rounded-md border border-ink-600 bg-ink-800 px-4 py-2 font-mono text-xs text-slate-300 hover:text-emerald-300"
        >
          Go to analyzer
        </button>
      </div>
    );
  }

  const duration = result.audio.duration_sec;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Analysis result</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            analysis #{result.analysis_id ?? "?"} · {result.audio.filename}
            {duration !== null ? ` · ${duration.toFixed(1)} s` : ""}
          </p>
        </div>
        <button
          onClick={onNewAnalysis}
          className="rounded-md border border-ink-600 bg-ink-800 px-4 py-2 font-mono text-xs text-slate-300 transition-colors hover:text-emerald-300"
        >
          Analyze another clip
        </button>
      </section>

      <p className="rounded-lg bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-300 ring-1 ring-amber-400/20">
        Placeholder pipeline response — audio intake works end-to-end. The three ML signals
        (speech-to-text, speaker match, AI-voice risk, behavior analysis) are wired in Phases 3-7,
        so no scores are computed yet.
      </p>

      <RiskGauge value={result.overall_risk_pct} decision={result.decision} components={result.risk_components} />

      <SignalBreakdown result={result} />

      <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Transcript</p>
        <p className={`mt-3 border-l-2 pl-4 text-base leading-relaxed ${result.transcript ? "border-emerald-400/40 text-slate-200" : "border-ink-600 text-slate-500"}`}>
          {result.transcript ?? "Available from Phase 3 (faster-whisper)."}
        </p>
        {result.language && (
          <p className="mt-3 font-mono text-[11px] text-slate-600">detected language: {result.language} · faster-whisper base</p>
        )}
      </section>

      <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Reasons</p>
        <ul className="mt-3 space-y-2">
          {result.reasons.map((r) => (
            <li key={r} className="flex gap-2 text-sm text-slate-300">
              <span className="text-emerald-400">·</span>
              {r}
            </li>
          ))}
        </ul>
      </section>

      {result.behavior && result.behavior.matched.length > 0 && (
        <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">
            Flagged phrases — suspicious-request analysis
          </p>
          <ul className="mt-4 space-y-3">
            {result.behavior.matched.map((m, i) => (
              <li key={`${m.category}-${i}`} className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-amber-300">{m.category}</span>
                  <span className="font-mono text-xs text-slate-200">“{m.phrase}”</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">…{m.context}…</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="rounded-xl border border-ink-700 bg-ink-900/50 p-4">
        <summary className="cursor-pointer font-mono text-xs text-slate-500 hover:text-slate-300">
          Raw API response
        </summary>
        <pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-500">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}
