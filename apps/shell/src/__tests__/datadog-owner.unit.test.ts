/**
 * UNIT TEST - ../datadog-owner: ownerOfStack.
 *
 * One `it` per way a request can be attributed: to the remote under the
 * shell's wrappers, to nobody when only the shell is on the stack, and to
 * nobody when no frame was stamped. Stacks in the shape Chrome writes, and
 * stamps in the shape the Datadog plugin injects; no SDK is loaded.
 */
import { describe, expect, it } from "vitest";
import { ownerOfStack } from "../datadog-owner";

const SHELL = "demo-web-frontend";

const stamp = (url: string) => `Error\n    at ${url}:1:120`;
const stamps = {
  [stamp("http://localhost:4173/assets/sentry.js")]: { service: SHELL, version: "abc123" },
  [stamp("http://localhost:4173/assets/react-query.js")]: { service: SHELL, version: "abc123" },
  [stamp("http://localhost:4174/assets/PageState.js")]: {
    service: "demo-web-account-frontend",
    version: "abc123",
  },
};

describe("ownerOfStack", () => {
  it("looks past the shell's wrappers to the remote that sent the request", () => {
    const stack = [
      "Error: ",
      "    at Be (http://localhost:4173/assets/sentry.js:5:1614)",
      "    at getAccount (http://localhost:4174/assets/PageState.js:3:88)",
      "    at fetchQuery (http://localhost:4173/assets/react-query.js:2:400)",
    ].join("\n");

    expect(ownerOfStack(stack, stamps, SHELL)).toEqual({
      service: "demo-web-account-frontend",
      version: "abc123",
    });
  });

  it("leaves a request only the shell's code sent to the shell", () => {
    const stack = [
      "Error: ",
      "    at Be (http://localhost:4173/assets/sentry.js:5:1614)",
      "    at send (http://localhost:4173/assets/sentry.js:9:12)",
    ].join("\n");

    expect(ownerOfStack(stack, stamps, SHELL)).toBeUndefined();
  });

  it("attributes nothing when no frame came from a stamped chunk", () => {
    const stack = "Error: \n    at inject (chrome-extension://abc/content.js:1:1)";

    expect(ownerOfStack(stack, stamps, SHELL)).toBeUndefined();
  });
});
