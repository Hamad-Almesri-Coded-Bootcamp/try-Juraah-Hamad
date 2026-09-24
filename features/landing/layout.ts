/**
 * L1's own layout rhythm (the owner-approved bounded exception: docs/Acceptance Criteria and Test
 * Plan.md, L1; brand book "one bounded exception"), shared by the sections so the page keeps one set
 * of edges.
 *
 * From 834px the hero and the safety band are Daylight sky panels (`.jr-sky`): inset by `space-5`
 * from the window and padded by `space-6` inside. Every light section uses the same two steps,
 * nested, so its text starts on the same line as the text inside the navy panels. At phone width
 * everything runs on the 16px gutter the sky uses there.
 *
 * The whole page sits in one centred column capped at `content-wide`, so on a very wide window the
 * navy panels and the light sections still share their edges.
 *
 * `<main>` is a container (`@container` in LandingPage), so the sections that change shape with
 * width (the hero row, the bridge, the two-column list) key off the page's own inline size.
 */

/** The outer edge: the phone gutter, then the sky panel's inset. */
export const SECTION_OUTER = 'px-3 tablet:px-5';

/** The inner edge and the vertical rhythm of a light section. */
export const SECTION_INNER = 'flex w-full flex-col gap-5 py-6 tablet:gap-6 tablet:px-6';

/** A section heading: the display face, larger once the page is wide. */
export const SECTION_HEADING = 'jr-display m-0 text-h1 text-navy @[1000px]:text-display';

/** A prose block inside a wide section: capped at the reading width, start-aligned. */
export const PROSE = 'w-full max-w-content';
