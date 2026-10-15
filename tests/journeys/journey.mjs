// Journey helpers, ported to ESM from nitsuah/.github journeys/templates/journey.js
// (bb-mcp is "type": "module"). Update from the template, not by hand.
//
//   import { test, expect, step } from "./journey.mjs";
//
// Every step() is a test.step, so a failure names the step (the reporter
// fingerprints on it). API journeys have no pixels, so they pass
// { screenshot: false }; the Pages-site journey keeps the visual baseline.
import { test, expect } from "@playwright/test";

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * One user-visible step of a journey.
 * opts.screenshot  false to skip the visual baseline for this step
 * opts.target      a Locator to snapshot instead of the whole viewport
 * opts.mask        Locators to paint over
 */
export async function step(page, title, fn, opts = {}) {
  return test.step(title, async () => {
    await fn();
    if (page && opts.screenshot !== false) {
      await expect(opts.target || page).toHaveScreenshot(`${slug(title)}.png`, {
        mask: opts.mask,
        ...opts.screenshotOptions,
      });
    }
  });
}

export { test, expect, slug };
