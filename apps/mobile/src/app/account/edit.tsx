import * as Sentry from "@sentry/react-native";
import { revalidateLogic, useForm, type AnyFieldApi } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { toValues, updateAccount, type Account } from "@demo/account-core/api";
import { accountQueryKey, useAccount } from "@demo/account-core/use-account";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  accountSchema,
  type Language,
  type ValidAccount,
} from "@demo/account-core/validation";
import { FieldError, errorProps } from "../../components/FieldError";
import { ErrorBanner, LoadingStatus } from "../../components/PageState";
import { Screen } from "../../components/Screen";

/**
 * The form - the twin of apps/account/src/EditAccountPage.tsx, and the screen
 * where the shared package earns its keep: the schema, the validation mode, the
 * mutation, the cache write and the Sentry span are the SAME code as the web's,
 * because none of that was ever about the DOM.
 *
 * What changes is the controls. `<input>` is a `<TextInput>`, `<textarea>` is a
 * `<TextInput multiline>`, and `<select>` is a row of buttons: two languages do
 * not earn a picker on a phone, where a native wheel costs a modal and two
 * taps to change one value. Each is still one `form.Field`, so the form's shape
 * is unchanged.
 *
 * The submit button is in the HEADER rather than at the bottom of the form.
 * That is where a native user reaches for it, and it is why the screen keeps
 * `form.Subscribe` around it: the header needs to know whether the save is in
 * flight, and nothing else on the screen re-renders when it changes.
 */

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
  field: {
    gap: theme.space.xs,
  },
  label: {
    fontSize: theme.text.sm,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  // One control style for every input, the way the web writes one `control`
  // class for <input>, <select> and <textarea>: they are the same box with
  // different insides, and writing it once is what keeps them from drifting.
  control: {
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.text.base,
  },
  controlInvalid: {
    borderColor: theme.colors.danger,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  choices: {
    flexDirection: "row",
    gap: theme.space.sm,
  },
  choice: {
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  choiceSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  choiceLabel: {
    fontSize: theme.text.base,
    color: theme.colors.text,
  },
  choiceLabelSelected: {
    color: theme.colors.accent,
    fontWeight: "600",
  },
  headerButton: {
    fontSize: theme.text.base,
    fontWeight: "600",
    color: theme.colors.accent,
  },
  headerButtonDisabled: {
    color: theme.colors.textMuted,
  },
}));

/** The control's style, plus the invalid border when the field is flagged. */
const controlStyle = (field: AnyFieldApi) => [
  styles.control,
  field.state.meta.errors.length > 0 && styles.controlInvalid,
];

export default function EditAccountScreen() {
  const { data: account, isError: loadFailed } = useAccount();

  return (
    <Screen>
      <Stack.Screen options={{ title: "Edit your account", headerLargeTitle: false }} />

      {loadFailed ? (
        <ErrorBanner>Could not load your account. Please try again.</ErrorBanner>
      ) : !account ? (
        <LoadingStatus>Loading your account...</LoadingStatus>
      ) : (
        <AccountFields account={account} />
      )}
    </Screen>
  );
}

function AccountFields({ account }: { account: Account }) {
  const queryClient = useQueryClient();

  const save = useMutation({
    /*
     * The same `updateAccount`, inside a span of our own - and the same reason
     * as the web's: the fetch is already instrumented, so this adds the part
     * the network cannot see, from the tap to the cache holding the answer.
     * `startSpan` ends the span when the promise settles, so the wrapper has to
     * BE the mutationFn.
     */
    mutationFn: (values: ValidAccount) =>
      Sentry.startSpan({ name: "account.save", op: "ui.submit" }, () => updateAccount(values)),
    onSuccess: (saved) => {
      // Write the server's response straight into the cache, THEN leave.
      queryClient.setQueryData(accountQueryKey, saved);
      // The SHAPE of what was saved, never the contents - the same line
      // ../../sentry.ts draws with `sendDefaultPii: false`.
      Sentry.logger.info("Account updated", {
        langue: saved.langue,
        hasTelephone: saved.telephone !== null,
        bioLength: saved.bio.length,
      });
      /*
       * `dismissTo` rather than `navigate("/account")`: the summary is already
       * the screen underneath, and pushing a second copy of it is how a native
       * stack ends up with a back button that leads to the form you just left.
       * This pops back to it.
       *
       * And rather than a bare `back()`, which is the same thing only when
       * there IS something behind - a deep link straight to the form, or a test
       * mounting it at its own URL, has an empty stack and `back()` is then a
       * no-op that strands the user on a form they have already saved.
       */
      router.dismissTo("/account");
    },
  });

  const form = useForm({
    defaultValues: toValues(account),
    // Validate on submit, then re-validate on change once.
    validationLogic: revalidateLogic(),
    validators: { onDynamic: accountSchema },
    listeners: {
      // A failed save is stale the moment the user changes something.
      onChange: () => {
        if (save.isError) save.reset();
      },
    },
    onSubmit: ({ value }) => {
      // The form state holds what the controls hold, so `value` is the schema's
      // INPUT. Parsing here is what produces the OUTPUT the api layer wants.
      save.mutate(accountSchema.parse(value));
    },
  });

  return (
    <View accessibilityLabel="Account form" style={styles.form}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => {
                const busy = isSubmitting || save.isPending;

                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void form.handleSubmit()}
                    testID="save-account"
                  >
                    <Text style={[styles.headerButton, busy && styles.headerButtonDisabled]}>
                      {busy ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                );
              }}
            </form.Subscribe>
          ),
        }}
      />

      <form.Field name="nom">
        {(field) => (
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              accessibilityLabel="Name"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              autoCapitalize="words"
              style={controlStyle(field)}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </View>
        )}
      </form.Field>

      <form.Field name="prenom">
        {(field) => (
          <View style={styles.field}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              accessibilityLabel="First name"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              autoCapitalize="words"
              style={controlStyle(field)}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </View>
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              accessibilityLabel="Email"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              // The keyboard is the native half of `<input type="email">`: the
              // @ key is on the first layer, and nothing is auto-capitalised.
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={controlStyle(field)}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </View>
        )}
      </form.Field>

      <form.Field name="telephone">
        {(field) => (
          <View style={styles.field}>
            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput
              accessibilityLabel="Phone (optional)"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              keyboardType="phone-pad"
              style={controlStyle(field)}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </View>
        )}
      </form.Field>

      <form.Field name="langue">
        {(field) => (
          <View style={styles.field}>
            <Text style={styles.label}>Language</Text>
            <View accessibilityRole="radiogroup" style={styles.choices}>
              {LANGUAGES.map((language) => {
                const selected = field.state.value === language;

                return (
                  <Pressable
                    key={language}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={LANGUAGE_LABELS[language]}
                    onPress={() => field.handleChange(language satisfies Language)}
                    style={[styles.choice, selected && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
                      {LANGUAGE_LABELS[language]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <FieldError field={field} />
          </View>
        )}
      </form.Field>

      <form.Field name="bio">
        {(field) => (
          <View style={styles.field}>
            <Text style={styles.label}>Bio (optional)</Text>
            <TextInput
              accessibilityLabel="Bio (optional)"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              multiline
              style={[...controlStyle(field), styles.multiline]}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </View>
        )}
      </form.Field>

      {save.isError && <ErrorBanner>Something went wrong. Please try again.</ErrorBanner>}
    </View>
  );
}
