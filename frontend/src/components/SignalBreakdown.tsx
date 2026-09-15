/** Signal breakdown: the three sub-scores with mini-bars, pipeline notes and
 * the per-signal detail lines (closest reference / heuristic label / matches).
 */

import type { AnalyzeResponse } from "../api/client";
import { Card, SectionLabel } from "./ui";

const BAR_COLOR: Record<string, string> = {
  "Speaker match": "bg-ok",
  "AI-voice risk": "bg-stop",
  "Behavior risk": "bg-warn",
};

export default function SignalBreakdown({ result }: { result: AnalyzeResponse }) {
  const speakerDetail =
    result.speaker?.matched_name != null
      ? `closest reference: ${result.speaker.matched_name} (cosine ${result.speaker.similarity?.toFixed(3) ?? "?"})`
      : result.speaker && result.speaker.enrolled_count === 0
        ? "no reference voice enrolled — unknown/neutral"
        : null;

  const aiDetail =
    result.ai_voice && result.ai_voice.source !== "model"
      ? `heuristic estimate (model ${result.ai_voice.error ? "unavailable" : "inconclusive"})`
      : result.ai_voice?.scores.length
        ? result.ai_voice.scores.map((s) => `${s.label} ${(s.score * 100).toFixed(0)}%`).join(" · ")
        : null;

  const behaviorDetail = result.behavior?.matched_count
    ? `${result.behavior.matched_count} suspicious phrase(s) — ${result.behavior.categories_hit.join(", ")}`
    : result.behavior && !result.behavior.transcript_empty
      ? "no suspicious request phrases found"
      : null;

  const rows: { label: string; value: number | null; note: string; detail: string | null }[] = [
    { label: "Speaker match", value: result.signals.speaker_match_pct, note: result.pipeline_status.speaker_match, detail: speakerDetail },
    { label: "AI-voice risk", value: result.signals.ai_voice_risk_pct, note: result.pipeline_status.ai_voice_detection, detail: aiDetail },
    { label: "Behavior risk", value: result.signals.behavior_risk_pct, note: result.pipeline_status.behavior_analysis, detail: behaviorDetail },
  ];

  return (
    <Card className="p-5 sm:p-6">
      <SectionLabel>Signal breakdown</SectionLabel>
      <ul className="mt-4 space-y-4">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg">{r.label}</span>
              <span className="font-mono text-sm">{r.value === null ? "—" : `${r.value.toFixed(0)}%`}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
              <div
                className={`h-full rounded-full ${BAR_COLOR[r.label] ?? "bg-muted"}`}
                style={{ width: `${r.value ?? 0}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
              {r.note}
              {r.detail ? <span className="text-muted"> · {r.detail}</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
