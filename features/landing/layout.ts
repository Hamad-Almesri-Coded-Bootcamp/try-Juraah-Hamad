/**
 * L1's own layout rhythm (the owner-approved exception: docs/Acceptance Criteria and Test Plan.md
 * L1 row; navigation.md "the landing page has its own wider rhythm"), shared by the ten sections so
 * the boards' three gutters live in one place: `space-3` at phone (Landing.dc.html: 16px),
 * `space-5` at tablet, `space-6` at desktop (Landing1440.dc.html: 48px). `<main>` is a container
 * (`@container` in LandingPage), so the sections that change shape with width — the hero row, the
 * six-up feature grid — key off the page's own inline size rather than the viewport.
 */
export const SECTION_GUTTER = 'p-3 tablet:p-5 desktop:px-6';

/** A prose block inside a full-width section: capped at the reading width, start-aligned like the
 * boards, never stretched across a 1440px window (navigation.md: "cap content near 880px"). */
export const PROSE = 'w-full max-w-content';
