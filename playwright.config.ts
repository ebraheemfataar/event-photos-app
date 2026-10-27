import { defineConfig } from "@playwright/test";

// Browser tests (npm test). Uses the locally installed Google Chrome so no
// separate browser download is needed; in CI, run `npx playwright install
// chromium` and set PLAYWRIGHT_BROWSER=chromium.
export default defineConfig({
  testDir: "./tests",
  use: {
    channel: process.env.PLAYWRIGHT_BROWSER === "chromium" ? undefined : "chrome",
    headless: true,
  },
});
