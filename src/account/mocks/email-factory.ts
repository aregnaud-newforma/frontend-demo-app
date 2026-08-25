/*
  Test data factories for the email list. Every field has a default, so a test
  overrides only what its journey turns on and asserts against what the factory
  returned rather than a literal repeated in the assertion.

  Values are randomized-but-valid, for the reasons ./db-utils.ts spells out: a
  test that depends on a specific string breaks on the run that stops handing it
  out, and the parts a test really asserts on are the ones it passed in. What
  stays FIXED is the flags - `hasAttachments`, `hasMatchedTerms`, `filedVia`,
  `status` - because those select behaviour rather than carry data, and a test
  that branches on one overrides it explicitly.

  The types below are stand-ins for what this file imported in the project it
  was copied from: the platform SDK's `Email.*`, the project shapes, and the
  `useProjectInformation` hook.
*/
import { faker } from "@faker-js/faker";
import { UniqueEnforcer } from "enforce-unique";
import { Factory } from "fishery";
import { createEmail } from "./db-utils";

/* -------------------------------------------------------------------------- */
/* The email shapes, as the search API returns them.                          */
/* -------------------------------------------------------------------------- */

export interface EmailAddress {
  email: string;
  name: string;
}

export interface EmailSummary {
  messageId: string;
  subject: string;
  displaySubject: string;
  sentDate: string;
  receivedDate: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  replyTo: EmailAddress[];
  hasAttachments: boolean;
  body: string[];
  filedTimestamp: string;
  hasMatchedTerms: boolean;
  filedBy: string;
  filedVia: "addin" | "web";
}

export interface EmailAttachmentSummary {
  id: string;
  name: string;
  displayName: string;
  contentHit: boolean;
  contentType: string;
  sizeInBytes: number;
}

export interface SearchResponse {
  hits: EmailSummary[];
  paging: { totalCount: number };
}

/* -------------------------------------------------------------------------- */
/* The project shapes, as the page reads them.                                */
/* -------------------------------------------------------------------------- */

export const ProjectUserRole = {
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
} as const;

export type ProjectUserRole = (typeof ProjectUserRole)[keyof typeof ProjectUserRole];

export interface ProjectUser {
  id: number;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
}

export interface Team {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  name: string;
  number: string;
  status: string;
  author: ProjectUser;
  users: ProjectUser[];
  teams: Team[];
  permissions: {
    role: ProjectUserRole;
    teams: Team[];
    isReviewer: boolean;
  };
  imageUrl: string | null;
  createdAt: string;
  startDate: string | null;
  endDate: string | null;
}

/* What `useProjectInformation` hands back: the query state, plus whether it ran at all. */
export interface ProjectInformationResult {
  data: Project | undefined;
  error: { code: number } | null;
  refetch: () => Promise<void>;
  isEnabled: boolean;
  isLoading: boolean;
  status: "idle" | "loading" | "success" | "error";
}

/* -------------------------------------------------------------------------- */
/* The factories.                                                             */
/* -------------------------------------------------------------------------- */

/*
  Fishery. `define` takes a callback returning a complete object, so a field
  derived from a sibling - `displaySubject` from `subject`, `receivedDate` from
  `sentDate` - is just a local const, the same way it would be in a plain
  function.

    emailSummaryFactory.build()
    emailSummaryFactory.build({ subject: "Invoice" })       // shallow
    emailSummaryFactory.build({ from: { email: "boss@x" } }) // nested, MERGED
    emailSummaryFactory.buildList(3)

  Nested plain objects are deep-merged, so the second call keeps the generated
  `from.name`. ARRAYS ARE NOT: `{ to: [{ email }] }` replaces the array whole
  rather than merging element 0, which would silently drop `to[0].name`. The
  compiler catches it - a partial element is missing required fields - and the
  fix is to build the element: `{ to: [emailAddressFactory.build({ email })] }`.
*/

// A user id has to be a number here, so db-utils' uuid is no help: two users
// built in the same test must not share one, or "the row for user X" stops
// meaning anything.
const uniqueUserIdEnforcer = new UniqueEnforcer();

export const emailAddressFactory = Factory.define<EmailAddress>(() => ({
  email: createEmail(),
  name: faker.person.fullName(),
}));

export const emailSummaryFactory = Factory.define<EmailSummary>(() => {
  // Derived rather than drawn three times: an email cannot be received before
  // it was sent, nor filed before it arrived, and a test asserting on the
  // timeline needs that to hold on every run.
  const sentDate = faker.date.recent({ days: 30 });
  const receivedDate = faker.date.soon({ days: 1, refDate: sentDate });
  const filedDate = faker.date.soon({ days: 7, refDate: receivedDate });
  const subject = faker.lorem.sentence();

  return {
    messageId: faker.string.uuid(),
    subject,
    // What the search endpoint echoes back, identical until a term matches.
    displaySubject: subject,
    sentDate: sentDate.toISOString(),
    receivedDate: receivedDate.toISOString(),
    from: emailAddressFactory.build(),
    to: emailAddressFactory.buildList(1),
    cc: [],
    replyTo: [],
    hasAttachments: false,
    body: [faker.lorem.paragraph()],
    filedTimestamp: filedDate.toISOString(),
    hasMatchedTerms: false,
    filedBy: String(uniqueUserIdEnforcer.enforce(() => faker.number.int({ min: 1, max: 999_999 }))),
    filedVia: "addin",
  };
});
