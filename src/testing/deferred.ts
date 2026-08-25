/**
 * A promise and its resolver, handed back together.
 *
 * What it is for: a test asserting an IN-FLIGHT state - the spinner, the
 * disabled "Saving..." button - needs the request still open when that
 * assertion runs. The handler awaits the promise, the test resolves it on the
 * line where the answer should land:
 *
 *   const { promise: serverAnswers, resolve: answer } = deferred();
 *   worker.use(http.put(ACCOUNT_URL, async () => {
 *     await serverAnswers;
 *     return HttpResponse.json(account);
 *   }));
 *
 * `delay()` and a fake clock TIME the answer instead of PLACING it, so the
 * assertion races a duration nobody controls - green on a fast machine, red in
 * CI. A held answer lands exactly where the test puts it.
 *
 * This is `Promise.withResolvers`, which Chromium has shipped since 119. It is
 * hand-rolled because tsconfig.json targets ES2021, so TypeScript does not
 * declare it; when that `lib` moves to ES2024 this file goes.
 */
export function deferred<T = void>() {
  let resolve: (value: T) => void = () => {};

  const promise = new Promise<T>((resolveIt) => {
    resolve = resolveIt;
  });

  return { promise, resolve };
}
