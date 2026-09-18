// The activity log's half of the mock store, beside `@account/mocks/db`.
//
// Its own Collection rather than a field on the account: the log is a list that
// grows on its own, and the handlers read and write it without touching the
// account record. Two collections is also what the real server has — two Maps —
// so a test that seeds one and not the other reproduces a state the product can
// genuinely be in.
import { Collection } from "@msw/data";
import * as z from "zod";
import { ACTIVITY_KINDS } from "../helpers/kinds";

export const activity = new Collection({
  schema: z.object({
    id: z.string(),
    kind: z.enum(ACTIVITY_KINDS),
    // ISO 8601, as the server sends it. Stored as a string and not a Date so
    // the fixture is the same shape that comes off the wire.
    at: z.string(),
    summary: z.string(),
    device: z.string().nullable(),
    note: z.string(),
  }),
});

/** The stored record type, for the factories and the handlers. */
export type ActivityRecord = ReturnType<typeof activity.findMany>[number];
