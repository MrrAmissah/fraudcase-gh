import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { getRiskLevel } from "../lib/utils/risk";

interface RiskScoreCardProps {
  score: number;
}

export default function RiskScoreCard({ score }: RiskScoreCardProps) {
  const riskInfo = getRiskLevel(score);

  // SVG parameters for neat visual radial circle
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getDialColor = (s: number) => {
    if (s >= 80) return "#ef4444"; // red
    if (s >= 50) return "#f97316"; // orange
    return "#eab308"; // yellow
  };

  return (
    <div className="p-6 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center space-y-4 shadow-sm" id="risk-score-radial-dial">
      <span className="text-[11px] font-sans text-slate-400 font-medium tracking-normal">
        Model risk analysis indicator
      </span>

      {/* Circle Dial Area */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          {/* background circle */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-slate-100"
            strokeWidth="10"
            fill="transparent"
          />
          {/* animated score ring */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            stroke={getDialColor(score)}
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center leading-none">
          <span className="text-3xl font-black font-mono text-slate-800">{score}%</span>
          <span className="text-[11px] font-sans text-slate-400 font-normal mt-1">
            Suspicion index
          </span>
        </div>
      </div>

      {/* Bottom text explanation */}
      <div className="space-y-1 max-w-sm">
        <h4 className={`text-[14px] font-semibold font-sans tracking-tight ${riskInfo.color}`}>
          {riskInfo.label} Threat Indicator
        </h4>
        <p className="text-[13.5px] text-slate-500 font-sans leading-relaxed font-normal">
          {riskInfo.description}
        </p>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[13px] text-amber-800 flex items-start gap-1.5 leading-normal max-w-sm text-left font-sans font-normal">
        <AlertCircle size={14} className="flex-shrink-0 text-amber-100 mt-0.5" />
        <span>
          Risk indicators reflect standard scam schemas. Do not export as defining evidence of absolute guilt.
        </span>
      </div>
    </div>
  );
}
