import * as Sentry from "@sentry/react";
import * as stylex from "@stylexjs/stylex";
import { revalidateLogic, useForm, type AnyFieldApi } from "@tanstack/react-form";
import { Link, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FieldError, errorProps } from "./components/FieldError";
import { ErrorBanner, LoadingStatus } from "./components/PageState";
import { toValues, updateAccount, type Account } from "@demo/account-core/api";
import { accountQueryKey, useAccount } from "@demo/account-core/use-account";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  accountSchema,
  type ValidAccount,
} from "@demo/account-core/validation";
import { colors, radius, shadow, space, text } from "@demo/tokens/tokens.stylex";

const styles = stylex.create({
  title: {
    margin: 0,
    marginBottom: space.xl,
    fontSize: text.xl,
    fontWeight: 650,
    letterSpacing: "-0.02em",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: space.lg,
    marginBottom: space.xl,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: space.xs,
  },
  label: {
    fontSize: text.sm,
    fontWeight: 550,
    color: colors.textMuted,
  },
  // One control style for <input>, <select> and <textarea>: they are the same
  // box with different insides, and writing it once is what keeps them from
  // drifting a pixel apart.
  control: {
    width: "100%",
    paddingBlock: space.sm,
    paddingInline: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: colors.border, ":focus": colors.accent },
    backgroundColor: colors.surface,
    color: colors.text,
    outline: "none",
    boxShadow: { default: null, ":focus": shadow.focus },
  },
  // Applied AFTER `control` in the same props() call, so its border wins by
  // argument order rather than by being more specific.
  controlInvalid: {
    borderColor: colors.danger,
  },
  textarea: {
    minHeight: "5.5rem",
    resize: "vertical",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: space.lg,
    marginTop: space.sm,
  },
  submit: {
    paddingBlock: space.md,
    paddingInline: space.xl,
    borderRadius: radius.md,
    borderStyle: "none",
    backgroundColor: colors.accent,
    color: colors.accentText,
    fontWeight: 550,
    cursor: { default: "pointer", ":disabled": "progress" },
    opacity: { default: 1, ":hover": 0.9, ":disabled": 0.6 },
  },
  cancel: {
    color: colors.textMuted,
    fontSize: text.sm,
    textDecoration: { default: "none", ":hover": "underline" },
  },
});

/**
 * The control's styles, plus the invalid border when the field is flagged.
 *
 * A function rather than six copies of the same expression, and ONE
 * `stylex.props` call rather than a base class with an "invalid" class layered
 * on: inside a single call the last argument wins deterministically, which is
 * the guarantee StyleX is built to give.
 */
const controlProps = (field: AnyFieldApi) =>
  stylex.props(styles.control, field.state.meta.errors.length > 0 && styles.controlInvalid);

/** Same, for the one control that is a box rather than a line. */
const textareaProps = (field: AnyFieldApi) =>
  stylex.props(
    styles.control,
    styles.textarea,
    field.state.meta.errors.length > 0 && styles.controlInvalid,
  );

export function EditAccountPage() {
  const { data: account, isError: loadFailed } = useAccount();

  if (loadFailed) {
    return <ErrorBanner>Could not load your account. Please try again.</ErrorBanner>;
  }

  if (!account) {
    return <LoadingStatus>Loading your account...</LoadingStatus>;
  }

  return (
    <>
      <h1 {...stylex.props(styles.title)}>Edit your account</h1>
      <AccountFields account={account} />
      <Link to="/account" {...stylex.props(styles.cancel)}>
        Cancel
      </Link>
    </>
  );
}

function AccountFields({ account }: { account: Account }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const save = useMutation({
    /*
     * The same `updateAccount`, inside a span of our own.
     *
     * The fetch is already instrumented - the SDK puts an `http.client` span on
     * every request without being asked - so this one adds the part the network
     * cannot see: it opens when the user submits and closes when the cache has
     * the server's answer, which is the duration the user actually waited.
     * `ui.submit` is what it is FOR, `http.client` is what it DOES, and a trace
     * is worth reading when it says both.
     *
     * `startSpan` ends the span when the promise it returns settles, so the
     * wrapper has to BE the mutationFn - wrapping `save.mutate` would end the
     * span the instant the mutation was queued and measure nothing.
     */
    mutationFn: (values: ValidAccount) =>
      Sentry.startSpan({ name: "account.save", op: "ui.submit" }, () => updateAccount(values)),
    onSuccess: (saved) => {
      // Write the server's response straight into the cache, THEN leave.
      queryClient.setQueryData(accountQueryKey, saved);
      // The SHAPE of what was saved, never the contents - the same line
      // `dataCollection.userInfo` draws in ../sentry.ts. Which language someone
      // picked and whether they left the phone empty is what says the form
      // works; their name and email would only say who they are.
      Sentry.logger.info("Account updated", {
        langue: saved.langue,
        hasTelephone: saved.telephone !== null,
        bioLength: saved.bio.length,
      });
      /*
       * The same event, counted rather than written down.
       *
       * A log answers "what happened in THIS session"; a metric answers "how
       * often, and is it moving" - saves per hour, split by language, with no
       * log search to run. Both are stamped with the current trace, so a spike
       * on the chart opens the traces that made it.
       *
       * Attributes, not names: `account.updated` with `langue: "fr"` stays one
       * series to chart, where `account.updated.fr` would be a new metric per
       * language. Same rule as the log template above.
       */
      Sentry.metrics.count("account.updated", 1, {
        attributes: { langue: saved.langue, hasTelephone: saved.telephone !== null },
      });
      // A distribution rather than a count, because the interesting question is
      // the SHAPE - p50 against p95 - not the total.
      Sentry.metrics.distribution("account.bio_length", saved.bio.length);
      void navigate("/account");
    },
  });

  const form = useForm({
    defaultValues: toValues(account),
    // Validate on submit, then re-validate on change once.
    validationLogic: revalidateLogic(),
    validators: { onDynamic: accountSchema },
    listeners: {
      // A failed save is stale the moment the user changes something
      onChange: () => {
        if (save.isError) save.reset();
      },
    },
    onSubmit: ({ value }) => {
      // The form state holds what the DOM holds, so `value` is the schema's
      // INPUT. Parsing here is what produces the OUTPUT the api layer wants.
      save.mutate(accountSchema.parse(value));
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      noValidate
      aria-label="Account form"
      {...stylex.props(styles.form)}
    >
      <form.Field name="nom">
        {(field) => (
          <div {...stylex.props(styles.field)}>
            <label htmlFor="nom" {...stylex.props(styles.label)}>
              Name
            </label>
            <input
              id="nom"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...controlProps(field)}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <form.Field name="prenom">
        {(field) => (
          <div {...stylex.props(styles.field)}>
            <label htmlFor="prenom" {...stylex.props(styles.label)}>
              First name
            </label>
            <input
              id="prenom"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...controlProps(field)}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <div {...stylex.props(styles.field)}>
            <label htmlFor="email" {...stylex.props(styles.label)}>
              Email
            </label>
            <input
              id="email"
              type="email"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...controlProps(field)}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <form.Field name="telephone">
        {(field) => (
          <div {...stylex.props(styles.field)}>
            <label htmlFor="telephone" {...stylex.props(styles.label)}>
              Phone (optional)
            </label>
            <input
              id="telephone"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...controlProps(field)}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <form.Field name="langue">
        {(field) => (
          <div {...stylex.props(styles.field)}>
            <label htmlFor="langue" {...stylex.props(styles.label)}>
              Language
            </label>
            <select
              id="langue"
              name={field.name}
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.target.value as typeof field.state.value)
              }
              onBlur={field.handleBlur}
              {...controlProps(field)}
              {...errorProps(field)}
            >
              <option value="">Choose a language</option>
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {LANGUAGE_LABELS[language]}
                </option>
              ))}
            </select>
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <form.Field name="bio">
        {(field) => (
          <div {...stylex.props(styles.field)}>
            <label htmlFor="bio" {...stylex.props(styles.label)}>
              Bio (optional)
            </label>
            <textarea
              id="bio"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...textareaProps(field)}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <div {...stylex.props(styles.actions)}>
        <button type="submit" disabled={save.isPending} {...stylex.props(styles.submit)}>
          {save.isPending ? "Saving..." : "Save"}
        </button>
      </div>

      {save.isError && <ErrorBanner>Something went wrong. Please try again.</ErrorBanner>}
    </form>
  );
}
