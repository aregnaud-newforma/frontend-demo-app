/**
 * Component coverage for SummaryRow.
 */
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { SummaryRow } from "../SummaryRow";

/** dt/dd are only valid inside a dl, so each case mounts one around the row. */
async function renderRow(term: string, children: React.ReactNode) {
  return await render(
    <dl>
      <SummaryRow term={term}>{children}</SummaryRow>
    </dl>,
  );
}

describe("SummaryRow", () => {
  describe("rendering", () => {
    it("renders without crashing", async () => {
      const screen = await renderRow("Email", "ada@example.com");
      await expect.element(screen.getByText("Email", { exact: true })).toBeVisible();
    });

    it("renders the term", async () => {
      const screen = await renderRow("Email", "ada@example.com");
      await expect.element(screen.getByText("Email", { exact: true })).toBeVisible();
    });

    it("renders the value", async () => {
      const screen = await renderRow("Email", "ada@example.com");
      await expect.element(screen.getByText("ada@example.com", { exact: true })).toBeVisible();
    });

    it("renders the term inside a dt", async () => {
      const screen = await renderRow("Email", "ada@example.com");
      await expect.element(screen.getByText("Email", { exact: true })).toBeVisible();
      expect(document.querySelector("dt")?.textContent).toBe("Email");
    });

    it("renders the value inside a dd", async () => {
      const screen = await renderRow("Email", "ada@example.com");
      await expect.element(screen.getByText("ada@example.com", { exact: true })).toBeVisible();
      expect(document.querySelector("dd")?.textContent).toBe("ada@example.com");
    });

    it("renders the dt before the dd", async () => {
      const screen = await renderRow("Email", "ada@example.com");
      await expect.element(screen.getByText("Email", { exact: true })).toBeVisible();
      const children = [...(document.querySelector("dl")?.children ?? [])];
      expect(children.map((child) => child.tagName)).toEqual(["DT", "DD"]);
    });

    it("renders exactly one row", async () => {
      const screen = await renderRow("Email", "ada@example.com");
      await expect.element(screen.getByText("Email", { exact: true })).toBeVisible();
      expect(document.querySelectorAll("dt")).toHaveLength(1);
      expect(document.querySelectorAll("dd")).toHaveLength(1);
    });
  });

  describe("children", () => {
    it("accepts a string child", async () => {
      const screen = await renderRow("Name", "Lovelace");
      await expect.element(screen.getByText("Lovelace", { exact: true })).toBeVisible();
    });

    it("accepts a number child", async () => {
      const screen = await renderRow("Age", 36);
      await expect.element(screen.getByText("36", { exact: true })).toBeVisible();
    });

    it("accepts an element child", async () => {
      const screen = await renderRow("Site", <a href="https://example.com">example.com</a>);
      await expect.element(screen.getByRole("link", { name: "example.com" })).toBeVisible();
    });

    it("renders an empty dd when the value is an empty string", async () => {
      const screen = await renderRow("Bio", "");
      await expect.element(screen.getByText("Bio", { exact: true })).toBeVisible();
      expect(document.querySelector("dd")?.textContent).toBe("");
    });

    it("renders the Not provided fallback passed by the page", async () => {
      const screen = await renderRow("Phone", "Not provided");
      await expect.element(screen.getByText("Not provided", { exact: true })).toBeVisible();
    });
  });

  describe("terms used by the account summary", () => {
    it("renders the Name term", async () => {
      const screen = await renderRow("Name", "Lovelace");
      await expect.element(screen.getByText("Name", { exact: true })).toBeVisible();
    });

    it("renders the First name term", async () => {
      const screen = await renderRow("First name", "Ada");
      await expect.element(screen.getByText("First name", { exact: true })).toBeVisible();
    });

    it("renders the Phone term", async () => {
      const screen = await renderRow("Phone", "0612345678");
      await expect.element(screen.getByText("Phone", { exact: true })).toBeVisible();
    });

    it("renders the Language term", async () => {
      const screen = await renderRow("Language", "French");
      await expect.element(screen.getByText("Language", { exact: true })).toBeVisible();
    });

    it("renders the Bio term", async () => {
      const screen = await renderRow("Bio", "Mathematician");
      await expect.element(screen.getByText("Bio", { exact: true })).toBeVisible();
    });
  });
});
