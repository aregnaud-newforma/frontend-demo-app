import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Two processes, because that is the point of this tier: the production
  // bundle on 4173, and the REAL account API on 3001 that it talks to through
  // the preview server's proxy. Nothing is intercepted - the specs seed the API
  // and then read back from it. Playwright starts both, waits for both URLs to
  // answer, and shuts both down afterwards.
  webServer: [
    {
      command: "yarn api:start",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      // `dotnet run` restores and compiles before it listens, which on a cold
      // CI runner is most of a minute before the first /health answers.
      timeout: 120_000,
    },
    {
      command: "yarn build && yarn preview",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
