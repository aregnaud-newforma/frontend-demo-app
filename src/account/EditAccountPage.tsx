import { revalidateLogic, useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FieldError, errorProps } from "./components/FieldError";
import { toValues, updateAccount, type Account } from "./helpers/api";
import { accountQueryKey, useAccount } from "./hooks/use-account";
import { LANGUAGES, LANGUAGE_LABELS, accountSchema } from "./helpers/validation";

export function EditAccountPage() {
  const { data: account, isError: loadFailed } = useAccount();

  if (loadFailed) {
    return <p role="alert">Could not load your account. Please try again.</p>;
  }

  if (!account) {
    return <p role="status">Loading your account...</p>;
  }

  return (
    <>
      <h1>Edit your account</h1>
      <AccountFields account={account} />
      <Link to="/account">Cancel</Link>
    </>
  );
}

function AccountFields({ account }: { account: Account }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const save = useMutation({
    mutationFn: updateAccount,
    onSuccess: (saved) => {
      // Write the server's response straight into the cache, THEN leave.
      queryClient.setQueryData(accountQueryKey, saved);
      void navigate({ to: "/account" });
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
    >
      <form.Field name="nom">
        {(field) => (
          <div>
            <label htmlFor="nom">Name</label>
            <input
              id="nom"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <form.Field name="prenom">
        {(field) => (
          <div>
            <label htmlFor="prenom">First name</label>
            <input
              id="prenom"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <form.Field name="telephone">
        {(field) => (
          <div>
            <label htmlFor="telephone">Phone (optional)</label>
            <input
              id="telephone"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <form.Field name="langue">
        {(field) => (
          <div>
            <label htmlFor="langue">Language</label>
            <select
              id="langue"
              name={field.name}
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.target.value as typeof field.state.value)
              }
              onBlur={field.handleBlur}
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
          <div>
            <label htmlFor="bio">Bio (optional)</label>
            <textarea
              id="bio"
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...errorProps(field)}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      <button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving..." : "Save"}
      </button>

      {save.isError && <p role="alert">Something went wrong. Please try again.</p>}
    </form>
  );
}
