// Journeys config. Contract:
// https://github.com/nitsuah/.github/blob/main/journeys/STANDARD.md
//
// bb-mcp has no UI, so most journeys use Playwright's `request` fixture
// against the real server (`npm run build && node dist/index.js`) with dummy
// Blackboard credentials: no journey ever reaches a real Blackboard. One
// browser journey covers the Pages site (docs/brag) served locally.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import { API_PORT, SITE_PORT, MCP_API_KEY } from "../tests/journeys/env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  testDir: path.join(root, "tests/journeys"),
  testMatch: "*.spec.mjs",
  // Linux-only baselines (always generated in the Playwright Docker image).
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{testName}/{arg}{ext}",
  // A missing baseline fails in CI instead of being silently written.
  updateSnapshots: process.env.CI ? "none" : "missing",
  // The journeys share one server (and its in-memory rate-limit window).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0, // pass-on-retry = flaky, not an issue
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(root, "journeys-report/report.json") }],
  ],
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: Number(process.env.JOURNEYS_MAX_DIFF ?? 20),
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "api",
      testMatch: "api.spec.mjs",
      use: { baseURL: `http://127.0.0.1:${API_PORT}` },
    },
    {
      name: "site",
      testMatch: "site.spec.mjs",
      use: {
        baseURL: `http://127.0.0.1:${SITE_PORT}`,
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: "npm run build && node dist/index.js",
      cwd: root,
      url: `http://127.0.0.1:${API_PORT}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        // Dummy credentials: config.ts only requires that they are set.
        BB_CLIENT_ID: "journeys-dummy-client-id",
        BB_CLIENT_SECRET: "journeys-dummy-client-secret",
        HOST: "127.0.0.1",
        PORT: String(API_PORT),
        MCP_API_KEY,
        PUBLIC_BASE_URL: `http://127.0.0.1:${API_PORT}`,
      },
    },
    {
      command: `node tests/journeys/static-server.mjs docs/brag ${SITE_PORT}`,
      cwd: root,
      url: `http://127.0.0.1:${SITE_PORT}/`,
      reuseExistingServer: false,
    },
  ],
});
