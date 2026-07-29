import React, { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Hero headline that types through several value propositions in turn.
 *
 * Each message is split into a plain lead and an accented tail so the brand color
 * lands on the payoff phrase. The animated text is hidden from assistive tech and
 * the <h1> carries a stable aria-label instead, so screen readers get one clear
 * heading rather than a stream of partial words.
 *
 * Wording note: these are marketing claims on a compliance-sensitive product.
 * Keep them about organizing and signalling. Nothing here should imply the
 * product proves fraud, determines guilt, or produces a legal filing.
 */

/* Keep these within a few characters of each other. The headline reserves two
   lines, and a longer message would wrap to three and shove the page down. */
const MESSAGES = [
  { lead: "Turn scam messages into a ", accent: "clear case report" },
  { lead: "Quick Check any message in ", accent: "seconds" },
  { lead: "Turn scattered chats into an ", accent: "organized case" },
  { lead: "Turn a suspicious link into a ", accent: "clear signal" },
  { lead: "Turn screenshots into ", accent: "structured evidence" },
];

const TYPE_MS = 45;
const DELETE_MS = 22;
const HOLD_MS = 2000;

export default function RotatingHeadline({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  const [messageIndex, setMessageIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(false);

  const message = MESSAGES[messageIndex];
  const full = message.lead + message.accent;

  // Typing runs on a ~45ms timer chain. Stop it while the tab is in the
  // background rather than animating text nobody is looking at.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (reduced || hidden) return;

    // Finished typing: hold, then start deleting.
    if (!deleting && charCount === full.length) {
      const hold = setTimeout(() => setDeleting(true), HOLD_MS);
      return () => clearTimeout(hold);
    }

    // Finished deleting: advance to the next message.
    if (deleting && charCount === 0) {
      setDeleting(false);
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
      return;
    }

    const tick = setTimeout(
      () => setCharCount((c) => c + (deleting ? -1 : 1)),
      deleting ? DELETE_MS : TYPE_MS,
    );
    return () => clearTimeout(tick);
  }, [charCount, deleting, full.length, reduced, hidden]);

  // Reduced motion: show the first message in full, no typing.
  const shown = reduced ? full : full.slice(0, charCount);
  const complete = reduced || charCount === full.length;
  const leadShown = shown.slice(0, Math.min(shown.length, message.lead.length));
  const accentShown = shown.length > message.lead.length ? shown.slice(message.lead.length) : "";

  return (
    <h1
      id="hero-title"
      className={`grid ${className}`}
      aria-label="Turn scam messages into a clear case report."
    >
      {/* Invisible sizers. Every message is stacked into the same grid cell, so
          the heading is always exactly as tall as the longest one wraps at the
          current width. A fixed min-height cannot do this: at 390px some of
          these wrap to three lines and others to two, which shifted the page
          each time the text changed. */}
      {MESSAGES.map((m) => (
        <span
          key={m.accent}
          aria-hidden="true"
          className="col-start-1 row-start-1 invisible"
        >
          {m.lead + m.accent}.
        </span>
      ))}

      <span aria-hidden="true" className="col-start-1 row-start-1">
        {leadShown}
        <span className="text-brand-600">{accentShown}</span>
        {/* The full stop belongs to a finished sentence only. Showing it while
            characters are still arriving reads as "organized ca." */}
        {complete && "."}
        {!reduced && (
          <span
            className="inline-block w-[3px] translate-y-[0.08em] bg-brand-600 animate-fade-in-out ml-0.5"
            style={{ height: "0.78em" }}
          />
        )}
      </span>
    </h1>
  );
}
