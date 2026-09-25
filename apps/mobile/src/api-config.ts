import { setApiBaseUrl } from "@demo/account-core/api-base-url";

/**
 * Where this app's requests go, said once, before anything can make one.
 *
 * The web never has to answer this question - the page and the API share an
 * origin - but a bundle running on a phone has no origin to borrow, so the
 * value arrives from the environment. `EXPO_PUBLIC_` is what gets inlined into
 * the bundle at build time; on a simulator it is usually
 * `http://localhost:5000`, on a device the machine's address on the LAN.
 *
 * Imported by ../index.ts before `expo-router/entry`, so no screen can render -
 * and no query can run - against an unset base URL. Failing here, at startup,
 * with the name of the variable, is the whole reason this is not a `??` buried
 * in the fetch.
 */
const baseUrl = process.env.EXPO_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set: the app has no API to talk to. See apps/mobile/.env.example.",
  );
}

setApiBaseUrl(baseUrl);
