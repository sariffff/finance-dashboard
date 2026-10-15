import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests drive a real browser against the running app and the
// database in .env (locally: docker compose + npm run db:seed).
//   npm run test:e2e   # builds and starts the app, unless something already listens on :3000
config({ quiet: true });

const PORT = 3000;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // One worker: every test shares a single app server and database, and in
  // parallel the CPU-heavy steps (password hashing, PDF parsing) starved each
  // other into random timeouts. The suite is small; serial takes about a minute.
  workers: 1,
  expect: { timeout: 15_000 },
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /dashboard\.spec\.ts/ },
  ],
  // A production build, not `next dev`: on-demand compilation and hot reload
  // make timings unpredictable. CI has already built the app in an earlier step.
  webServer: {
    command: isCI ? "npm run start" : "npm run build && npm run start",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 300_000,
  },
});
