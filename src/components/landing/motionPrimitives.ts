import type { Variants } from "motion/react";

/**
 * Shared scroll-reveal variants for the landing sections. Every section uses the
 * same distances and easing so the page reads as one system rather than a pile of
 * independently animated blocks.
 *
 * Reduced motion is handled at the call site with `useReducedMotion()`: sections
 * pass `staticVariants` instead, which keeps the same variant names so the markup
 * does not have to branch.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Container that staggers its children as it scrolls into view. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

/** Default child reveal: a short rise with a fade. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

/** For hero art and mockups, which read better scaling up slightly. */
export const scaleItem: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

/** No-op variants used when the visitor prefers reduced motion. */
export const staticVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};

/** Viewport config shared by every scroll-revealed section. */
export const revealViewport = { once: true, amount: 0.25 } as const;
