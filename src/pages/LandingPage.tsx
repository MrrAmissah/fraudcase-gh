import React from "react";
import LandingHero from "../components/LandingHero";

interface LandingPageProps {
  onStart: () => void;
  onQuickCheck?: () => void;
}

export default function LandingPage({ onStart, onQuickCheck }: LandingPageProps) {
  return (
    <div className="flex flex-col justify-start w-full" id="landing-page">
      <LandingHero onGetStarted={onStart} onQuickCheck={onQuickCheck} />
    </div>
  );
}
