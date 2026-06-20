import React from "react";
import { getRiskLevel } from "../../lib/utils/risk";

interface RiskGaugeProps {
  score: number;
  size?: number;
}

/**
 * Pure SVG radial meter. Renders a 0–100 risk score as a colored arc with the numeric value and
 * the risk label below. Color thresholds mirror getRiskLevel so the gauge and the text badges stay
 * consistent. No chart library — just an SVG circle with a stroke-dashoffset arc.
 */
export default function RiskGauge({ score, size = 132 }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)));
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const risk = getRiskLevel(clamped);

  const color =
    clamped >= 80 ? "#ef4444" : clamped >= 50 ? "#f97316" : clamped >= 25 ? "#eab308" : "#10b981";

  return (
    <div className="flex flex-col items-center justify-center" id="risk-gauge">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={cx} cy={cx} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
          <circle
            cx={cx}
            cy={cx}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-[26px] font-black font-mono text-slate-800">{clamped}</span>
          <span className="text-[10px] text-slate-400 font-sans mt-0.5">/ 100</span>
        </div>
      </div>
      <span className={`mt-2 text-[12px] font-bold font-sans uppercase tracking-wide ${risk.color}`}>
        {risk.label} risk
      </span>
    </div>
  );
}
