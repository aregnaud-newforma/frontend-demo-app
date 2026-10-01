import * as Sentry from "@sentry/react-native";
import { DdRum, ErrorSource } from "@datadog/mobile-react-native";

/**
 * An error the app caught, told to both tools - for the errors neither SDK
 * sees on its own.
 *
 * Their global handlers catch what is thrown and left uncaught, and nothing
 * else: a render error React Native hands straight to its ExceptionsManager
 * (./app/account/_layout.tsx), and a rejected promise, which Sentry tracks and
 * Datadog's React Native SDK does not.
 *
 * Either call is a no-op when its SDK is off, as under jest.
 */
export function reportError(error: unknown) {
  Sentry.captureException(error);
  const { message, stack } = error instanceof Error ? error : new Error(String(error));
  void DdRum.addError(message, ErrorSource.SOURCE, stack ?? "");
}
