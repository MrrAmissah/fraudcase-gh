import React from "react";
import LandingHero from "../components/LandingHero";

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="flex flex-col justify-start w-full" id="landing-page">
      <LandingHero onGetStarted={onStart} />
    </div>
  );
}
