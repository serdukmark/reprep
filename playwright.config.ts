import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.E2E_URL || "http://127.0.0.1:8000",
    headless: true,
    actionTimeout: 12000,
    screenshot: "only-on-failure",
    trace: process.env.E2E_AUDIT === "1" ? "on" : "retain-on-failure",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
  },
  reporter: "list",
});
