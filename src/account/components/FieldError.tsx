import * as stylex from "@stylexjs/stylex";
import type { AnyFieldApi } from "@tanstack/react-form";
import { colors, space, text } from "@demo/tokens/tokens.stylex";

/**
 * How a field reports that it is invalid, in two halves that always ship
 * together: the aria the input wears, and the message it points at.
 *
 * They live in ONE module because they share an invariant no type can enforce -
 * the id `FieldError` renders is the id `errorProps` aims `aria-describedby` at.
 * Apart, they can drift into a dangling reference, which breaks nothing except
 * the screen reader announcement, and so goes unnoticed by everyone else.
 *
 * Typed against `AnyFieldApi` on purpose: nothing here reads a field's VALUE,
 * only its name and its errors, so it fits any TanStack Form field of any form
 * validated by any schema. That is also why it is worth a file of its own - the
 * next form gets its error wiring, and its accessibility, for free.
 */

/** The single source of the id, so the two halves below cannot disagree. */
function errorId(field: AnyFieldApi) {
  return `${field.name}-error`;
}

/**
 * The aria an invalid field wears. Spread it onto the control:
 * `<input {...errorProps(field)} />`. Valid fields get nothing, rather than
 * `aria-invalid="false"` - an attribute that is absent says the same thing more
 * quietly, and keeps the DOM honest about which fields are actually flagged.
 */
export function errorProps(field: AnyFieldApi) {
  return field.state.meta.errors.length
    ? { "aria-invalid": true, "aria-describedby": errorId(field) }
    : {};
}

/**
 * A field's first validation message, carrying the id `errorProps` advertises.
 *
 * The FIRST, not all of them: `aria-describedby` names a single element here,
 * and one message at a time is what a user can act on. `role="alert"` announces
 * it when it appears, which is the point of rendering it conditionally rather
 * than hiding a permanent node.
 *
 * Reads both error shapes TanStack Form can hold: Standard Schema issues (what
 * a Zod schema produces, `{ message }`) and the bare strings a hand-written
 * validator may return - so the next form is not forced to validate the way
 * this one happens to.
 */
const styles = stylex.create({
  // Colour is not the only signal - the message is text, it is announced by
  // `role="alert"`, and the input beside it wears `aria-invalid`. The red is
  // the fourth way of saying it, not the first.
  message: {
    margin: 0,
    marginTop: space.xs,
    fontSize: text.sm,
    color: colors.danger,
  },
});

export function FieldError({ field }: { field: AnyFieldApi }) {
  const [error] = field.state.meta.errors;
  if (!error) return null;

  return (
    <p
      id={errorId(field)}
      role="alert"
      data-testid={`field-error-${field.name}`}
      {...stylex.props(styles.message)}
    >
      {typeof error === "string" ? error : error.message}
    </p>
  );
}
