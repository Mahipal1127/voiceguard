/** Phase 2 — placeholder result view.
 * Honest by design: no scores are invented. Phase 8 replaces this with the
 * full judge-facing dashboard (RiskGauge, SignalBreakdown, transcript).
 */

import type { AnalyzeResponse } from "../api/client";

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

      <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Decision</p>
            <p className="mt-2 inline-block rounded-md bg-slate-500/10 px-4 py-1.5 font-mono text-lg font-semibold text-slate-300 ring-1 ring-slate-400/20">
              {result.decision}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Overall risk</p>
            <p className="mt-2 font-mono text-3xl text-slate-600">—</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Signal breakdown</p>
        <ul className="mt-4 space-y-3">
          {(
            [
              ["Speaker match", result.signals.speaker_match_pct, result.pipeline_status.speaker_match],
              ["AI-voice risk", result.signals.ai_voice_risk_pct, result.pipeline_status.ai_voice_detection],
              ["Behavior risk", result.signals.behavior_risk_pct, result.pipeline_status.behavior_analysis],
            ] as const
          ).map(([label, value, note]) => (
            <li key={label} className="flex items-center justify-between border-b border-ink-700 pb-3 last:border-0 last:pb-0">
              <span className="text-sm text-slate-300">{label}</span>
              <span className="font-mono text-xs text-slate-500">
                {value === null ? "— " : `${value.toFixed(0)}% `}
                <span className="text-slate-600">({note})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Transcript</p>
        <p className="mt-3 text-sm text-slate-500">
          {result.transcript ?? "Available from Phase 3 (faster-whisper)."}
        </p>
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
