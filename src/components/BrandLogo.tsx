import React, { useId } from "react";

interface BrandLogoProps {
  variant?: "icon" | "full";
  className?: string;
  height?: string | number;
}

export default function BrandLogo({
  variant = "full",
  className = "",
  height,
}: BrandLogoProps) {
  // Keep clean responsive sizing
  const computedHeight = height || (variant === "full" ? 36 : 30);

  // Generate a unique ID suffix per instance to prevent SVG gradient id collisions in the DOM
  const uniqueId = useId().replace(/[:\+]/g, "");
  const shieldGradId = `shieldGrad-${uniqueId}`;
  const cyanGradId = `cyanGrad-${uniqueId}`;
  const foldGradId = `foldGrad-${uniqueId}`;

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 100 100"
        height={computedHeight}
        className={`inline-block ${className}`}
        xmlns="http://www.w3.org/2000/svg"
        id={`brand-logo-icon-${uniqueId}`}
      >
        <defs>
          <linearGradient id={shieldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id={cyanGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id={foldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
        </defs>

        {/* 1. Shield Outline / Page Body */}
        <path
          d="M 22 18 
             C 22 12, 26 10, 32 10 
             L 60 10 
             L 78 28 
             L 78 70 
             C 78 82, 64 89, 50 91.5 
             C 36 89, 22 82, 22 70 
             Z"
          fill={`url(#${shieldGradId})`}
        />

        {/* 2. Page Lines ("F" structure and document notches) */}
        <rect x="32" y="24" width="22" height="4.5" rx="1" fill="#FFFFFF" fillOpacity="0.25" />
        <rect x="32" y="34.5" width="14" height="4.5" rx="1" fill="#FFFFFF" fillOpacity="0.25" />

        {/* 3. Folded Corner Triangle (Top Right Page Fold) */}
        <path
          d="M 60 10 L 78 28 L 60 28 Z"
          fill={`url(#${foldGradId})`}
        />

        {/* 4. Magnifying Glass & FC Monogram Circle Ring */}
        <circle
          cx="55"
          cy="55"
          r="21"
          fill="none"
          stroke={`url(#${cyanGradId})`}
          strokeWidth="6"
        />

        {/* Checkmark inside the magnifier circle */}
        <path
          d="M 44 56 L 51 63 L 64 48"
          fill="none"
          stroke={`url(#${cyanGradId})`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Handle for Magnifying Glass */}
        <line
          x1="70"
          y1="70"
          x2="88"
          y2="88"
          stroke="#0F172A"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Full Wordmark Layout
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`} id={`brand-logo-full-${uniqueId}`}>
      {/* Icon portion */}
      <svg
        viewBox="0 0 100 100"
        height={computedHeight}
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id={shieldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id={cyanGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id={foldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
        </defs>

        <path
          d="M 22 18 
             C 22 12, 26 10, 32 10 
             L 60 10 
             L 78 28 
             L 78 70 
             C 78 82, 64 89, 50 91.5 
             C 36 89, 22 82, 22 70 
             Z"
          fill={`url(#${shieldGradId})`}
        />

        <rect x="32" y="24" width="22" height="4.5" rx="1" fill="#FFFFFF" fillOpacity="0.25" />
        <rect x="32" y="34.5" width="14" height="4.5" rx="1" fill="#FFFFFF" fillOpacity="0.25" />

        <path
          d="M 60 10 L 78 28 L 60 28 Z"
          fill={`url(#${foldGradId})`}
        />

        <circle
          cx="55"
          cy="55"
          r="21"
          fill="none"
          stroke={`url(#${cyanGradId})`}
          strokeWidth="6"
        />

        <path
          d="M 44 56 L 51 63 L 64 48"
          fill="none"
          stroke={`url(#${cyanGradId})`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <line
          x1="70"
          y1="70"
          x2="88"
          y2="88"
          stroke="#0F172A"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>

      {/* Styled text wordmark pairing */}
      <div className="flex flex-col text-left py-0.5">
        <div className="flex items-baseline leading-none">
          <span className="text-[17px] font-bold font-sans tracking-tight text-[#0F172A]">
            FraudCase
          </span>
          <span className="text-[17px] font-extrabold font-sans tracking-normal pl-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            GH
          </span>
        </div>
        <span className="text-[9px] font-semibold tracking-widest text-[#0F172A]/50 font-sans uppercase mt-0.5">
          EVIDENTIARY PORTAL
        </span>
      </div>
    </div>
  );
}
