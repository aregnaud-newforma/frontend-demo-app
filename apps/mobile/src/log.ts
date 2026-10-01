import * as Sentry from "@sentry/react-native";
import { DdLogs } from "@datadog/mobile-react-native";

/**
 * A structured log, written to both tools - the twin of ./report-error.ts for
 * the lines that are not errors. The web writes the two calls side by side
 * (apps/account/src/EditAccountPage.tsx); one function here keeps a screen
 * from logging to one tool and forgetting the other.
 *
 * The message takes a `Sentry.logger.fmt` template as well as a string. Sentry
 * keeps its template and parameters, so every line from one call site groups
 * as one; Datadog gets the formatted text, and groups by pattern on its own.
 *
 * Attributes are primitives because Sentry's are: it drops an object or an
 * array where Datadog would have taken one.
 *
 * Each call is a no-op when its SDK is off, as under jest.
 */
type Message = Parameters<typeof Sentry.logger.info>[0];
type Attributes = Record<string, string | number | boolean>;

export const log = {
  debug: (message: Message, attributes?: Attributes) => {
    Sentry.logger.debug(message, attributes);
    void DdLogs.debug(String(message), attributes);
  },
  info: (message: Message, attributes?: Attributes) => {
    Sentry.logger.info(message, attributes);
    void DdLogs.info(String(message), attributes);
  },
  warn: (message: Message, attributes?: Attributes) => {
    Sentry.logger.warn(message, attributes);
    void DdLogs.warn(String(message), attributes);
  },
};
