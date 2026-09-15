/** Result screen — gauge, signals, transcript, flagged phrases, decision. */

import { useState } from "react";
import type { AnalyzeResponse } from "../api/client";
import RiskGauge from "../components/RiskGauge";
import SignalBreakdown from "../components/SignalBreakdown";
import { Card, SecondaryButton, SectionLabel } from "../components/ui";

interface ResultPageProps {
  result: AnalyzeResponse | null;
  onNewAnalysis: () => void;
}

const RECOMMENDED_ACTION: Record<string, string> = {
  ALLOW: "No action needed — nothing suspicious was detected in this clip.",
  WARN: "Stay alert — review the flagged signals below before trusting this call.",
  VERIFY:
    "Ask a question only the real person would know, or call them back on a known number before complying.",
  BLOCK: "Do not comply — end the call, then report the impersonation attempt.",
};

const ACTION_COLOR: Record<string, string> = {
  ALLOW: "text-ok",
  WARN: "text-warn",
  VERIFY: "text-check",
  BLOCK: "text-stop",
};

export default function ResultPage({ result, onNewAnalysis }: ResultPageProps) {
  const [copied, setCopied] = useState(false);

  const copyTranscript = async () => {
    if (!result?.transcript) return;
    try {
      await navigator.clipboard.writeText(result.transcript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

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

      {RECOMMENDED_ACTION[result.decision] && (
        <Card className="flex items-start gap-3 p-4">
          <svg
            viewBox="0 0 24 24"
            className={`mt-0.5 h-5 w-5 shrink-0 ${ACTION_COLOR[result.decision] ?? "text-muted"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l2 2 3.5-4" />
          </svg>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Recommended action</p>
            <p className="mt-1 text-sm leading-relaxed text-fg">{RECOMMENDED_ACTION[result.decision]}</p>
          </div>
        </Card>
      )}

      <SignalBreakdown result={result} />

      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <SectionLabel>Transcript</SectionLabel>
          {result.transcript && (
            <button
              onClick={() => void copyTranscript()}
              className="rounded-md border border-line2 px-2.5 py-1 font-mono text-[11px] text-muted transition hover:border-accent/40 hover:text-fg"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          )}
        </div>
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
