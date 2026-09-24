import { defineConfig, devices } from "@playwright/test";
import { remoteEntry, remotes } from "./federation.config";

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
  // Five processes, because that is the point of this tier: the REAL backend -
  // the account API on 3001 and the notifications service it calls on 3002 -
  // and the production bundles as they deploy, the shell on 4173, which talks
  // to the API through its preview server's proxy, and each remote on the port
  // federation.config.ts gives it, which the shell fetches pages from over the
  // wire. Nothing is intercepted - the specs seed the API and then read back
  // from it, and from the notifications service the API called. Playwright
  // starts all five, waits for every URL to answer, and shuts them down
  // afterwards.
  //
  // Each build builds itself, in parallel, the way separate deployments would;
  // the remote's readiness URL is its entry file, so a shell that answers
  // before its remote does is still not "up". `tsc` is not run here - that is
  // `yarn verify`'s half of `yarn build`, and this tier is about the bundle.
  webServer: [
    {
      command: "yarn accounts:start",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      // `dotnet run` restores and compiles before it listens, which on a cold
      // CI runner is most of a minute before the first /health answers.
      timeout: 120_000,
    },
    {
      // The second backend service. Started beside the API rather than by it:
      // they are two deployments, and a save that reaches a process this config
      // forgot to start is a failure worth seeing here rather than a silently
      // skipped notification (server/Accounts/NotificationsClient.cs swallows the
      // error by design).
      command: "yarn notifications:start",
      url: "http://localhost:3002/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "yarn build:shell && yarn preview:shell",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    ...Object.entries(remotes).map(([name, { preview }]) => ({
      command: `yarn build:${name} && yarn preview:${name}`,
      url: `http://localhost:${preview}/${remoteEntry}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    })),
  ],
});
