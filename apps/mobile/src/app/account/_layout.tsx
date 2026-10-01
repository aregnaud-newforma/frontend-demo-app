import { useEffect } from "react";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { ErrorBanner } from "../../components/PageState";
import { Screen } from "../../components/Screen";
import { reportError } from "../../report-error";

/**
 * The account tab's stack: the summary, and the form pushed on top of it.
 *
 * The web navigates from /account to /account/edit and back, and a stack is
 * what that is on a phone - the back gesture, the sliding transition and the
 * title animation come from the platform, and `router.back()` on a successful
 * save pops the screen the user came from rather than pushing a third copy of
 * the summary.
 *
 * Large titles because that is the iOS idiom for the root of a tab, and because
 * it is where the screen's heading goes - the web renders an <h1> per page for
 * the same reason.
 */
export default function AccountStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
      }}
    />
  );
}

/**
 * What the tab shows when one of its screens throws while rendering - the twin
 * of the web's apps/shell/src/layout/RouteErrorBoundary.tsx, and here for the
 * same two reasons.
 *
 * Without it, React unmounts the whole app: the tab bar goes with the screen,
 * and there is no way out but killing the app. Expo Router wraps this route in
 * whatever it exports as `ErrorBoundary`, so the tabs in ../_layout.tsx, which
 * sit above it, survive and are the way out.
 *
 * And a render error never reaches either SDK on its own. React Native hands
 * it straight to `ExceptionsManager.handleException`
 * (react-native/Libraries/Core/ReactFiberErrorDialog.js), not to the global
 * handler Sentry and Datadog replace, so both are told here by hand - in an
 * effect, so a re-render cannot report the same crash twice.
 */
export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <Screen>
      <ErrorBanner testID="account-crash">Something went wrong on this screen.</ErrorBanner>
    </Screen>
  );
}
