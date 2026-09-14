/** Semi-circular risk gauge: fixed threshold zones (ALLOW/WARN/VERIFY/BLOCK),
 * a needle at the current score, and the auditable score formula underneath.
 * Thresholds are fixed by the source document — do not change here either.
 */

interface RiskGaugeProps {
  value: number | null;
  decision: string;
  components?: { base: number; ai_term: number; behavior_term: number } | null;
}

const RADIUS = 80;
const CENTER = 100;
const STROKE = 15;

// Map score (0-100) to angle: 0 -> 180° (left), 100 -> 0° (right).
function angleFor(value: number): number {
  return 180 - (Math.min(100, Math.max(0, value)) / 100) * 180;
}

function polar(angleDeg: number, r = RADIUS): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER - r * Math.sin(rad) };
}

function zoneArc(from: number, to: number): string {
  const a = polar(angleFor(from));
  const b = polar(angleFor(to));
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const ZONES: { from: number; to: number; color: string; label: string }[] = [
  { from: 0, to: 29, color: "#34D399", label: "ALLOW" },
  { from: 30, to: 59, color: "#FBBF24", label: "WARN" },
  { from: 60, to: 79, color: "#FB923C", label: "VERIFY" },
  { from: 80, to: 100, color: "#F43F5E", label: "BLOCK" },
];

export default function RiskGauge({ value, decision, components }: RiskGaugeProps) {
  const shown = value ?? 0;
  const needle = polar(angleFor(shown), RADIUS - STROKE - 8);

  return (
    <section className="rounded-xl border border-ink-600 bg-ink-900/70 p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <svg viewBox="0 0 200 118" className="w-64 shrink-0" role="img" aria-label={`Overall risk ${shown} of 100, decision ${decision}`}>
          {ZONES.map((z) => (
            <path
              key={z.label}
              d={zoneArc(z.from, z.to)}
              stroke={z.color}
              strokeWidth={shown >= z.from && shown <= z.to ? STROKE + 3 : STROKE}
              fill="none"
              strokeLinecap="butt"
              opacity={shown >= z.from && shown <= z.to ? 1 : 0.55}
            />
          ))}
          {/* threshold ticks */}
          {[0, 30, 60, 80, 100].map((t) => {
            const p1 = polar(angleFor(t), RADIUS + STROKE / 2 + 2);
            const p2 = polar(angleFor(t), RADIUS + STROKE / 2 + 7);
            return <line key={t} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#64748B" strokeWidth="2" />;
          })}
          {/* needle */}
          <line x1={CENTER} y1={CENTER} x2={needle.x} y2={needle.y} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          <circle cx={CENTER} cy={CENTER} r="6" fill="#0B1210" stroke="#E2E8F0" strokeWidth="2" />
          <text x={CENTER} y={CENTER - 22} textAnchor="middle" className="fill-slate-100" fontSize="26" fontWeight="700" fontFamily="ui-monospace, monospace">
            {value === null ? "—" : Math.round(shown)}
          </text>
          <text x="14" y="116" fontSize="9" fill="#64748B" fontFamily="ui-monospace, monospace">0</text>
          <text x="182" y="116" fontSize="9" fill="#64748B" fontFamily="ui-monospace, monospace">100</text>
        </svg>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Decision</p>
          <p
            className={`mt-2 inline-block rounded-md px-6 py-2.5 font-mono text-3xl font-bold tracking-widest ring-1 ${
              decision === "ALLOW"
                ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
                : decision === "WARN"
                  ? "bg-amber-400/10 text-amber-300 ring-amber-400/30"
                  : decision === "VERIFY"
                    ? "bg-orange-400/10 text-orange-300 ring-orange-400/30"
                    : decision === "BLOCK"
                      ? "bg-rose-500/10 text-rose-300 ring-rose-400/30"
                      : "bg-slate-500/10 text-slate-300 ring-slate-400/20"
            }`}
          >
            {decision}
          </p>
          {components && (
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-slate-500">
              score = base {components.base} (speaker) + AI-voice {components.ai_term} (weight 40) + behavior {components.behavior_term} (weight 35)
            </p>
          )}
          <p className="mt-1 font-mono text-[11px] text-slate-600">
            thresholds fixed — 0-29 {ZONES[0].label} · 30-59 {ZONES[1].label} · 60-79 {ZONES[2].label} · 80-100 {ZONES[3].label}
          </p>
        </div>
      </div>
    </section>
  );
}
