import { Stack } from "expo-router";

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
