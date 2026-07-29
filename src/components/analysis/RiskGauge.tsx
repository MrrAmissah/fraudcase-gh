import React from "react";
import { getRiskLevel } from "../../lib/utils/risk";

interface RiskGaugeProps {
  score: number;
  size?: number;
}

const SEGMENTS = 40;
const SWEEP = 270; // degrees, leaving a gap at the bottom
const START = 225; // degrees, measured counter-clockwise from the positive x axis

/**
 * Segmented radial risk dial. The score lights up a proportion of the ticks
 * around a 270-degree sweep, with the value and risk label in the open centre.
 *
 * The score-to-color thresholds deliberately mirror getRiskLevel so the dial and
 * the text badges never disagree. Change them here only if you change them there.
 */
export default function RiskGauge({ score, size = 132 }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)));
  const risk = getRiskLevel(clamped);

  const color =
    clamped >= 80 ? "#ef4444" : clamped >= 50 ? "#f97316" : clamped >= 25 ? "#eab308" : "#10b981";

  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 1;
  const tickLen = Math.max(7, size * 0.13);
  const inner = outer - tickLen;
  const tickWidth = Math.max(2.5, size * 0.027);

  const ticks = Array.from({ length: SEGMENTS }, (_, i) => {
    const ratio = i / (SEGMENTS - 1);
    const deg = START - ratio * SWEEP;
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      x1: cx + cos * inner,
      y1: cy - sin * inner,
      x2: cx + cos * outer,
      y2: cy - sin * outer,
      on: ratio * 100 <= clamped,
    };
  });

  return (
    <div className="flex flex-col items-center" id="risk-gauge">
      <div className="relative" style={{ width: size, height: size * 0.9 }}>
        <svg width={size} height={size} className="absolute inset-0" aria-hidden="true">
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.on ? color : "#e2e8f0"}
              strokeWidth={tickWidth}
              strokeLinecap="round"
              style={{
                transition: "stroke 0.45s ease",
                transitionDelay: `${i * 8}ms`,
              }}
            />
          ))}
        </svg>

        <div
          className="absolute inset-x-0 flex flex-col items-center leading-none"
          style={{ top: size * 0.3 }}
        >
          <span
            className="font-bold font-mono text-slate-900 tracking-tight"
            style={{ fontSize: Math.round(size * 0.3) }}
          >
            {clamped}
          </span>
          <span
            className="text-slate-400 font-sans mt-1.5"
            style={{ fontSize: Math.max(9, Math.round(size * 0.08)) }}
          >
            /100
          </span>
        </div>
      </div>

      <span
        className={`font-semibold font-sans uppercase tracking-[0.08em] ${risk.color}`}
        style={{ fontSize: Math.max(9.5, Math.round(size * 0.085)) }}
      >
        {risk.label} risk
      </span>
    </div>
  );
}
