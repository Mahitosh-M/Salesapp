import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "browser.spec.ts",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  reporter: "list",
  outputDir: "artifacts/browser",
  use: {
    baseURL: "http://127.0.0.1:5175",
    headless: true,
    launchOptions: {
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    },
    screenshot: "only-on-failure",
  },
});
