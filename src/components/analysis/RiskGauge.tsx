import React from "react";
import { getRiskLevel } from "../../lib/utils/risk";

interface RiskGaugeProps {
  score: number;
  size?: number;
}

/**
 * Semicircular risk meter. Renders a 0-100 score as a swept arc over a graduated
 * track, with the numeric value and risk label beneath.
 *
 * The score-to-color thresholds deliberately mirror getRiskLevel so the meter and
 * the text badges never disagree. Change them here only if you change them there.
 *
 * The arc uses pathLength={100} so the dash math is just the score itself, with
 * no arc-length trigonometry to keep in sync with the radius.
 */
export default function RiskGauge({ score, size = 132 }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)));
  const risk = getRiskLevel(clamped);

  const stroke = Math.max(7, Math.round(size * 0.085));
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;

  // Semicircle sweeping left to right over the top.
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const svgHeight = cy + stroke / 2;

  const color =
    clamped >= 80 ? "#ef4444" : clamped >= 50 ? "#f97316" : clamped >= 25 ? "#eab308" : "#10b981";

  // Graduated ticks around the dial, drawn just outside the track.
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const angle = Math.PI - (i / 10) * Math.PI;
    const inner = r + stroke / 2 + 2;
    const outer = inner + (i % 5 === 0 ? 5 : 3);
    return {
      x1: cx + Math.cos(angle) * inner,
      y1: cy - Math.sin(angle) * inner,
      x2: cx + Math.cos(angle) * outer,
      y2: cy - Math.sin(angle) * outer,
      major: i % 5 === 0,
    };
  });

  const tickPad = stroke / 2 + 9;

  return (
    <div className="flex flex-col items-center" id="risk-gauge">
      <div style={{ width: size + tickPad * 2 }} className="relative">
        <svg
          width={size + tickPad * 2}
          height={svgHeight + tickPad}
          viewBox={`${-tickPad} ${-tickPad} ${size + tickPad * 2} ${svgHeight + tickPad}`}
          aria-hidden="true"
        >
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.major ? "#cbd5e1" : "#e2e8f0"}
              strokeWidth={t.major ? 1.6 : 1}
              strokeLinecap="round"
            />
          ))}

          <path d={arc} fill="none" stroke="#f1f5f9" strokeWidth={stroke} strokeLinecap="round" />
          <path
            d={arc}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - clamped}
            style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>

        {/* Value sits inside the dial's open centre. */}
        <div
          className="absolute inset-x-0 flex flex-col items-center leading-none"
          style={{ top: svgHeight * 0.44 }}
        >
          <span
            className="font-bold font-mono text-slate-900 tracking-tight"
            style={{ fontSize: Math.round(size * 0.27) }}
          >
            {clamped}
          </span>
          <span
            className="text-slate-400 font-sans mt-1"
            style={{ fontSize: Math.max(9, Math.round(size * 0.082)) }}
          >
            /100
          </span>
        </div>
      </div>

      <span
        className={`mt-1.5 font-semibold font-sans uppercase tracking-[0.08em] ${risk.color}`}
        style={{ fontSize: Math.max(9.5, Math.round(size * 0.085)) }}
      >
        {risk.label} risk
      </span>
    </div>
  );
}
