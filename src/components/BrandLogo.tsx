import React from "react";

interface BrandLogoProps {
  variant?: "icon" | "full";
  className?: string;
  height?: string | number;
}

const ICON_SRC = "/brand/fraudcase-icon-square.png";

/** Brand logo using the actual FraudCase icon asset (shield-F + magnifier + check). */
export default function BrandLogo({ variant = "full", className = "", height }: BrandLogoProps) {
  const computedHeight = height ?? (variant === "full" ? 34 : 30);
  const px = typeof computedHeight === "number" ? `${computedHeight}px` : computedHeight;

  if (variant === "icon") {
    return (
      <img
        src={ICON_SRC}
        alt="FraudCase GH"
        style={{ height: px, width: "auto" }}
        className={`inline-block ${className}`}
      />
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <img src={ICON_SRC} alt="" style={{ height: px, width: "auto" }} className="flex-shrink-0" />
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
