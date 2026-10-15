// Pages-site journeys: docs/brag (what CI deploys to nitsuah.github.io/bb-mcp)
// served locally by tests/journeys/static-server.mjs. Local files are fetched
// from that server; the three outbound links are HEAD-checked for real.
import { test, expect, step } from "./journey.mjs";

test.beforeEach(async ({ page }) => {
  // Render the installed fallback fonts every run: a third-party stylesheet
  // arrives at a different time on every network. The hero mp4 is aborted so the
  // baseline sees the poster, not a video frame.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.abort(),
  );
  await page.route(/\.mp4(\?|$)/, (route) => route.abort());
  await page.addInitScript(() => {
    document.documentElement.style.setProperty(
      "scroll-behavior",
      "auto",
      "important",
    );
  });
});

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(() => [...document.images].every((i) => i.complete)),
    )
    .toBe(true);
}

const OUTBOUND = [
  "https://github.com/nitsuah/bb-mcp",
  "https://github.com/nitsuah/bb-mcp/blob/main/README.md",
  "https://developer.blackboard.com",
];

test(
  "visitor opens the bb-mcp page and finds the hero video, the kit and working links",
  { tag: ["@feature:mcp-protocol-implementation", "@area:site"] },
  async ({ page, request }) => {
    await step(page, "open the page and read the headline", async () => {
      await page.goto("/");
      await expect(page).toHaveTitle(
        "bb-mcp — MCP Server for Blackboard Learn",
      );
      await expect(page.locator("h1")).toHaveText("bb-mcp");
      await expect(page.locator(".tagline")).toContainText("40 tools");
      await settle(page);
    });

    await step(
      page,
      "the hero video and the vertical cut have a poster and a source",
      async () => {
        for (const [id, base] of [
          ["#bragVideo", "bb-mcp-21s"],
          ["#shortVideo", "bb-mcp-21s-vert"],
        ]) {
          const video = page.locator(id);
          await expect(video).toHaveAttribute("poster", `${base}.jpg`);
          await expect(video.locator("source")).toHaveAttribute(
            "src",
            `${base}.mp4`,
          );
          const poster = await request.get(`/${base}.jpg`);
          expect(poster.status()).toBe(200);
          expect(poster.headers()["content-type"]).toBe("image/jpeg");
          const mp4 = await request.get(`/${base}.mp4`, {
            headers: { Range: "bytes=0-1023" },
          });
          expect(mp4.status()).toBe(206);
          expect(mp4.headers()["content-type"]).toBe("video/mp4");
        }
      },
      { screenshot: false },
    );

    await step(
      page,
      "the expand kit loads and puts a fullscreen button on each video",
      async () => {
        await expect(
          page.locator("script[src*='showcase/expand.js']"),
        ).toHaveAttribute(
          "src",
          "https://cdn.jsdelivr.net/gh/nitsuah/.github@main/showcase/expand.js",
        );
        await expect
          .poll(() => page.evaluate(() => window.__showcaseExpand))
          .toBeTruthy();
        await expect(page.locator(".sx-vbtn")).toHaveCount(2);
      },
      { screenshot: false },
    );

    await step(
      page,
      "every link, image and video file on the page resolves",
      async () => {
        const hrefs = await page.$$eval("a[href]", (as) => [
          ...new Set(as.map((a) => a.getAttribute("href"))),
        ]);
        expect(hrefs.sort()).toEqual([...OUTBOUND].sort());
        // Third-party hosts are only checked on the nightly and manual runs (the workflow
        // sets JOURNEYS_EXTERNAL_LINKS there); a remote outage must not fail a pull request.
        if (process.env.JOURNEYS_EXTERNAL_LINKS) {
          for (const url of OUTBOUND) {
            const res = await request.head(url, { timeout: 20_000 });
            expect(res.status(), url).toBeLessThan(400);
          }
        }
        const files = await page.$$eval(
          "link[href]:not([href^=http]), video[poster], source[src]",
          (els) =>
            els.map(
              (e) =>
                e.getAttribute("href") ??
                e.getAttribute("poster") ??
                e.getAttribute("src"),
            ),
        );
        expect(files.length).toBeGreaterThanOrEqual(6);
        for (const file of files) {
          const res = await request.get(`/${file}`, {
            headers: { Range: "bytes=0-0" },
          });
          expect([200, 206], file).toContain(res.status());
        }
      },
      { screenshot: false },
    );
  },
);

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

  test(
    "visitor on a 375 px phone reads the page without sideways scrolling",
    { tag: ["@feature:mcp-protocol-implementation", "@area:site"] },
    async ({ page }) => {
      await step(page, "the page opens at 375 px", async () => {
        await page.goto("/");
        await expect(page.locator("h1")).toHaveText("bb-mcp");
        await settle(page);
      });
      await step(
        page,
        "nothing is wider than the screen",
        async () => {
          const widths = await page.evaluate(() => ({
            client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            body: document.body.scrollWidth,
          }));
          expect(widths.client).toBe(375);
          expect(widths.scroll).toBeLessThanOrEqual(375);
          expect(widths.body).toBeLessThanOrEqual(375);
          const wide = await page.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .filter((el) => el.getBoundingClientRect().right > 375.5)
              .map((el) => el.tagName + "." + el.className),
          );
          expect(wide).toEqual([]);
        },
        { screenshot: false },
      );
      await step(page, "the vertical cut sits in the page column", async () => {
        const box = await page.locator(".video-wrapper.vertical").boundingBox();
        expect(box.width).toBeLessThanOrEqual(340);
        expect(box.height / box.width).toBeCloseTo(16 / 9, 1);
        await page.locator(".video-wrapper.vertical").scrollIntoViewIfNeeded();
      });
    },
  );
});
