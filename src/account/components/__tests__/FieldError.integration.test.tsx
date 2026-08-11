/**
 * Component coverage for FieldError and its matching aria props, driven through
 * test ids so the selectors survive changes to the copy and the markup.
 */
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import type { AnyFieldApi } from "@tanstack/react-form";
import { FieldError, errorProps } from "../FieldError";

/**
 * A minimal stand-in for a TanStack Form field: FieldError only reads the name
 * and the errors, so the rest of the field api is not needed here.
 */
function createField(errors: unknown[], name = "email") {
  return { name, state: { meta: { errors } } } as unknown as AnyFieldApi;
}

const testId = (name = "email") => `field-error-${name}`;

describe("FieldError", () => {
  describe("when the field is valid", () => {
    it("renders no error node", async () => {
      await render(<FieldError field={createField([])} />);
      expect(document.querySelector(`[data-testid="${testId()}"]`)).toBeNull();
    });

    it("renders no error node for any field name", async () => {
      await render(<FieldError field={createField([], "nom")} />);
      expect(document.querySelectorAll(`[data-testid="${testId("nom")}"]`)).toHaveLength(0);
    });
  });

  describe("when the field is invalid", () => {
    it("renders the error node", async () => {
      const screen = await render(
        <FieldError field={createField([{ message: "Email is invalid" }])} />,
      );
      await expect.element(screen.getByTestId(testId())).toBeVisible();
    });

    it("renders the message inside the error node", async () => {
      const screen = await render(
        <FieldError field={createField([{ message: "Email is invalid" }])} />,
      );
      await expect.element(screen.getByTestId(testId())).toHaveTextContent("Email is invalid");
    });

    it("names the error node after the field", async () => {
      const screen = await render(
        <FieldError field={createField([{ message: "Name is required" }], "nom")} />,
      );
      await expect.element(screen.getByTestId(testId("nom"))).toBeVisible();
    });

    it("carries the id built from the field name", async () => {
      const screen = await render(
        <FieldError field={createField([{ message: "Email is invalid" }])} />,
      );
      await expect.element(screen.getByTestId(testId())).toHaveAttribute("id", "email-error");
    });

    it("builds the id from whichever field name it is given", async () => {
      const screen = await render(
        <FieldError field={createField([{ message: "Name is required" }], "nom")} />,
      );
      await expect.element(screen.getByTestId(testId("nom"))).toHaveAttribute("id", "nom-error");
    });

    it("renders a bare string error", async () => {
      const screen = await render(<FieldError field={createField(["Name is required"])} />);
      await expect.element(screen.getByTestId(testId())).toHaveTextContent("Name is required");
    });

    it("renders a Standard Schema issue error", async () => {
      const screen = await render(
        <FieldError field={createField([{ message: "Name is required" }])} />,
      );
      await expect.element(screen.getByTestId(testId())).toHaveTextContent("Name is required");
    });

    it("renders only the first of several errors", async () => {
      const screen = await render(
        <FieldError field={createField([{ message: "First problem" }, { message: "Second" }])} />,
      );
      await expect.element(screen.getByTestId(testId())).toHaveTextContent("First problem");
      expect(document.body.textContent).not.toContain("Second");
    });

    it("renders exactly one error node", async () => {
      const screen = await render(
        <FieldError field={createField([{ message: "First problem" }, { message: "Second" }])} />,
      );
      await expect.element(screen.getByTestId(testId())).toBeVisible();
      expect(document.querySelectorAll(`[data-testid="${testId()}"]`)).toHaveLength(1);
    });
  });
});

describe("errorProps", () => {
  it("returns an empty object for a valid field", () => {
    expect(errorProps(createField([]))).toEqual({});
  });

  it("does not set aria-invalid on a valid field", () => {
    expect(errorProps(createField([]))).not.toHaveProperty("aria-invalid");
  });

  it("sets aria-invalid on an invalid field", () => {
    expect(errorProps(createField([{ message: "nope" }]))).toHaveProperty("aria-invalid", true);
  });

  it("sets aria-describedby on an invalid field", () => {
    expect(errorProps(createField([{ message: "nope" }]))).toHaveProperty(
      "aria-describedby",
      "email-error",
    );
  });

  it("points aria-describedby at the id the error node carries", async () => {
    const field = createField([{ message: "Email is invalid" }]);
    const screen = await render(<FieldError field={field} />);
    await expect.element(screen.getByTestId(testId())).toBeVisible();

    const props = errorProps(field) as Record<string, unknown>;
    const node = document.querySelector(`[data-testid="${testId()}"]`);
    expect(node?.id).toBe(props["aria-describedby"]);
  });
});
