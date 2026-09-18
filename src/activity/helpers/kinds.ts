/**
 * The kinds of thing that land in the activity log, and the words a visitor
 * reads for each.
 *
 * Its own module rather than a corner of `api.ts`, because the server imports
 * it too: `server/api.ts` validates the `kinds` query parameter against this
 * list, and a second copy over there is how a filter starts accepting a kind
 * the frontend cannot render.
 */
export const ACTIVITY_KINDS = ["sign-in", "profile-change", "security"] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const KIND_LABELS: Record<ActivityKind, string> = {
  "sign-in": "Sign-ins",
  "profile-change": "Profile changes",
  security: "Security",
};

/** Whether a string off the wire — or out of a URL — is a kind we know. */
export const isActivityKind = (value: string): value is ActivityKind =>
  (ACTIVITY_KINDS as readonly string[]).includes(value);
