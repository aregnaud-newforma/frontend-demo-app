import type { AnyFieldApi } from "@tanstack/react-form";
import { Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * How a field reports that it is invalid, in the two halves that always ship
 * together: what the input wears, and the message it points at. The twin of the
 * web's apps/account/src/components/FieldError.tsx, and in one module for the
 * same reason - the two share an invariant no type can enforce.
 *
 * The web's half is `aria-describedby` pointing at an id; native has no ids to
 * point at, so `errorProps` hands the control the message itself through
 * `accessibilityHint`, plus the invalid state a screen reader announces. Same
 * two facts, said the way each platform says them.
 *
 * Typed against `AnyFieldApi`: nothing here reads a field's VALUE, only its
 * name and its errors, so it fits any TanStack Form field validated by any
 * schema.
 */

/** The message a field's first error carries, whatever shape it arrives in. */
function firstError(field: AnyFieldApi): string | undefined {
  const [error] = field.state.meta.errors;
  if (!error) return undefined;

  return typeof error === "string" ? error : (error as { message: string }).message;
}

/**
 * The accessibility an invalid field wears. Spread it onto the control:
 * `<TextInput {...errorProps(field)} />`. Valid fields get nothing rather than
 * `invalid: false`, which keeps the tree honest about which fields are flagged.
 */
export function errorProps(field: AnyFieldApi) {
  const message = firstError(field);

  return message ? { accessibilityInvalid: true, accessibilityHint: message } : {};
}

const styles = StyleSheet.create((theme) => ({
  // Colour is not the only signal - the message is text, it is announced, and
  // the control beside it is marked invalid. The red is the fourth way of
  // saying it, not the first.
  message: {
    marginTop: theme.space.xs,
    fontSize: theme.text.sm,
    color: theme.colors.danger,
  },
}));

export function FieldError({ field }: { field: AnyFieldApi }) {
  const message = firstError(field);
  if (!message) return null;

  return (
    <Text
      accessibilityLiveRegion="assertive"
      testID={`field-error-${field.name}`}
      style={styles.message}
    >
      {message}
    </Text>
  );
}
