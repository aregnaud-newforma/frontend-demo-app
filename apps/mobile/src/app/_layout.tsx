import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import { useNavigationContainerRef } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { createQueryClient } from "../query-client";
import { initSentry, navigationIntegration, sentryEnabled } from "../sentry";

/**
 * The shell every screen renders inside - the mobile twin of the web's
 * apps/shell/src/main.tsx and apps/shell/src/layout/RootLayout.tsx, which are
 * one file here because a native app has no document to own.
 *
 * The TABS are what the web's <Navigation> is: the app's map, in the place the
 * platform puts it. `NativeTabs` renders a real UITabBar on iOS and a Material
 * tab bar on Android rather than a row of styled <Pressable>s, which is the
 * whole reason to use it - the blur, the haptics and the accessibility come
 * from the OS.
 *
 * Imported from `expo-router/unstable-native-tabs`: the module is renamed to
 * `expo-router/native-tabs` in SDK 58, and this app is on 57.
 *
 * A tab is not registered by existing - unlike a stack screen, every tab needs
 * its `<NativeTabs.Trigger>` here, named after the route. `account` names the
 * DIRECTORY, whose own _layout.tsx is the stack the edit screen pushes onto.
 */

initSentry();

function RootLayout() {
  // One client for the life of the app, built through useState rather than a
  // bare call so a re-render keeps the cache it started with. The tests build
  // their own, per test - ../query-client.ts says why that matters.
  const [queryClient] = useState(createQueryClient);

  /*
   * What tells Sentry which screen a span belongs to. The integration wants the
   * navigation container, and expo-router only has one once it has mounted -
   * hence the ref and the effect rather than a call at module scope. Without
   * it, a navigation span is named by nothing and every screen's transactions
   * pile into one.
   */
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  return (
    <QueryClientProvider client={queryClient}>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="account">
          <NativeTabs.Trigger.Label>Your account</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </QueryClientProvider>
  );
}

// Wrapped only when there is a client to report to - ../sentry.ts says why.
export default sentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;
