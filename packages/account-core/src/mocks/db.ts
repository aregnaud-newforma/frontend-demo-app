// In-memory, stateful mock database powered by @msw/data (v1).
//
// Why bother instead of a plain vi.fn()? Because it gives the handlers a real
// store, and this example needs one: the GET reads an account back out, the PUT
// mutates it, and a test can then assert on the stored record. A stubbed fetch
// could fake either half, but not the fact that the two agree.
//
// NOTE (version): @msw/data v1 is the current package. The old @mswjs/data is
// deprecated (frozen at 0.16.2). v1 is a rewrite built on Standard Schema, so
// the collection is described with a plain Zod schema, and it is ESM-only.
import { Collection } from "@msw/data";
import * as z from "zod";
import { LANGUAGES } from "../validation";

export const accounts = new Collection({
  schema: z.object({
    id: z.string(),
    nom: z.string(),
    prenom: z.string(),
    email: z.string(),
    telephone: z.string().nullable(), // null when the user has no phone
    langue: z.enum(LANGUAGES),
    bio: z.string(),
  }),
});

/** The stored record type, for the factories and the handlers. */
export type AccountRecord = ReturnType<typeof accounts.findMany>[number];
