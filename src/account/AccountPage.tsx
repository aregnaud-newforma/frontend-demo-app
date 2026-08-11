import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
import { toValues } from "./helpers/api";
import { useAccount } from "./hooks/use-account";
import { LANGUAGE_LABELS } from "./helpers/validation";
import { SummaryRow } from "./components/SummaryRow";
import { colors, radius, space, text } from "../tokens.stylex";

const styles = stylex.create({
  title: {
    margin: 0,
    marginBottom: space.xl,
    fontSize: text.xl,
    fontWeight: 650,
    letterSpacing: "-0.02em",
  },
  // The list is the grid; each SummaryRow contributes a <dt> and a <dd>
  // straight into it, with no wrapper between. Two columns on a laptop,
  // stacked below 30rem.
  summary: {
    display: "grid",
    gridTemplateColumns: { default: "10rem 1fr", "@media (max-width: 30rem)": "1fr" },
    gap: { default: `${space.md} ${space.lg}`, "@media (max-width: 30rem)": space.xs },
    margin: 0,
    marginBottom: space.xl,
  },
  editLink: {
    display: "inline-block",
    paddingBlock: space.sm,
    paddingInline: space.lg,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    backgroundColor: { default: colors.surface, ":hover": colors.accentSoft },
    color: colors.accent,
    fontWeight: 550,
    fontSize: text.sm,
    textDecoration: "none",
  },
  status: {
    margin: 0,
    color: colors.textMuted,
  },
  error: {
    margin: 0,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
});

export function AccountPage() {
  const { data: account, isError: loadFailed } = useAccount();

  if (loadFailed) {
    return (
      <p role="alert" data-testid="account-error" {...stylex.props(styles.error)}>
        Could not load your account. Please try again.
      </p>
    );
  }

  if (!account) {
    return (
      <p role="status" data-testid="account-loading" {...stylex.props(styles.status)}>
        Loading your account...
      </p>
    );
  }

  const values = toValues(account);

  return (
    <>
      <h1 data-testid="account-heading" {...stylex.props(styles.title)}>
        Your account
      </h1>

      <dl
        aria-label="Account summary"
        data-testid="account-summary"
        {...stylex.props(styles.summary)}
      >
        <SummaryRow term="Name">{account.nom}</SummaryRow>
        <SummaryRow term="First name">{account.prenom}</SummaryRow>
        <SummaryRow term="Email">{account.email}</SummaryRow>
        {/* The empty wording stays at the call site rather than becoming a
            `fallback` prop: only two of the six fields are optional, and an
            option nobody sets reads as a feature the component has. */}
        <SummaryRow term="Phone">{values.telephone || "Not provided"}</SummaryRow>
        <SummaryRow term="Language">{LANGUAGE_LABELS[account.langue]}</SummaryRow>
        <SummaryRow term="Bio">{account.bio || "Not provided"}</SummaryRow>
      </dl>

      <Link to="/account/edit" data-testid="edit-account-link" {...stylex.props(styles.editLink)}>
        Edit your account
      </Link>
    </>
  );
}
