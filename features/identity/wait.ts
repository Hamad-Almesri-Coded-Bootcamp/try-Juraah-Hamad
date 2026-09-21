/**
 * A plain `setTimeout` delay, used only to hold a UI transition on screen long enough to read it
 * (the Hawiati "approved" checkmark, the setup screen's step change). Never a clock read (G3):
 * nothing here constructs a `Date` or calls `Date.now()`.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
