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

  const message = MESSAGES[messageIndex];
  const full = message.lead + message.accent;

  useEffect(() => {
    if (reduced) return;

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
  }, [charCount, deleting, full.length, reduced]);

  // Reduced motion: show the first message in full, no typing.
  const shown = reduced ? full : full.slice(0, charCount);
  const complete = reduced || charCount === full.length;
  const leadShown = shown.slice(0, Math.min(shown.length, message.lead.length));
  const accentShown = shown.length > message.lead.length ? shown.slice(message.lead.length) : "";

  return (
    <h1
      id="hero-title"
      className={className}
      aria-label="Turn scam messages into a clear case report."
    >
      <span aria-hidden="true">
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
