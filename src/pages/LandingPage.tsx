import React from "react";
import HeroSection from "../components/landing/HeroSection";
import TrustStrip from "../components/landing/TrustStrip";
import HowItWorks from "../components/landing/HowItWorks";
import EvidencePipeline from "../components/landing/EvidencePipeline";
import TrustBand from "../components/landing/TrustBand";

interface LandingPageProps {
  onStart: () => void;
  onQuickCheck?: () => void;
}

export default function LandingPage({ onStart, onQuickCheck }: LandingPageProps) {
  return (
    <div className="w-full flex flex-col flex-grow" id="landing-page">
      <HeroSection onGetStarted={onStart} onQuickCheck={onQuickCheck} />

      {/* Everything below the hero shares one rhythm on the tinted canvas.
          flex-grow keeps the tint running to the footer so no slate-50 sliver
          from the app shell shows through at the seam on short pages. */}
      <div className="bg-canvas border-t border-slate-100 flex-grow">
        <div className="space-y-14 lg:space-y-16 py-12 lg:py-14">
          <TrustStrip />
          <HowItWorks />
          <EvidencePipeline />
          <TrustBand />
        </div>
      </div>
    </div>
  );
}
