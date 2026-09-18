import * as z from "zod";
import { isValidFrenchPhone } from "./phone";

export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "French",
  en: "English",
};

/** One number for the schema and the counter under the field, so they agree. */
export const BIO_MAX_LENGTH = 200;

export const accountSchema = z.object({
  nom: z.string().trim().min(1, "Name is required"),
  prenom: z.string().trim().min(1, "First name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .refine((value) => z.email().safeParse(value).success, "Email is invalid"),
  telephone: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidFrenchPhone(value), "Phone number is invalid"),
  langue: z.union([z.enum(LANGUAGES), z.literal("")]).transform((value, ctx) => {
    if (value === "") {
      ctx.addIssue({ code: "custom", message: "Language is required" });
      return z.NEVER;
    }
    return value;
  }),
  bio: z.string().trim().max(BIO_MAX_LENGTH, `Bio must be ${BIO_MAX_LENGTH} characters or less`),
});

export type AccountValues = z.input<typeof accountSchema>;

export type ValidAccount = z.output<typeof accountSchema>;
