import React from "react";

interface BrandLogoProps {
  variant?: "icon" | "full";
  className?: string;
  height?: string | number;
}

/** Refined flat shield + cyan "verified" checkmark (matches /public/favicon.svg). */
function ShieldMark({ height, className = "" }: { height: number | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M18 20 L50 12 L82 20 V50 C82 72 68 88 50 94 C32 88 18 72 18 50 Z"
        fill="#0F172A"
      />
      <path
        d="M34 51 L46 63 L68 37"
        fill="none"
        stroke="#06B6D4"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BrandLogo({ variant = "full", className = "", height }: BrandLogoProps) {
  const computedHeight = height || (variant === "full" ? 34 : 30);

  if (variant === "icon") {
    return <ShieldMark height={computedHeight} className={`inline-block ${className}`} />;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <ShieldMark height={computedHeight} className="flex-shrink-0" />
      <div className="flex flex-col text-left leading-none">
        <div className="flex items-baseline">
          <span className="text-[17px] font-bold font-sans tracking-tight text-[#0F172A]">FraudCase</span>
          <span className="text-[17px] font-extrabold font-sans tracking-tight pl-1 text-cyan-500">GH</span>
        </div>
        <span className="text-[9px] font-semibold tracking-[0.18em] text-[#0F172A]/45 font-sans uppercase mt-1">
          Evidentiary Portal
        </span>
      </div>
    </div>
  );
}
