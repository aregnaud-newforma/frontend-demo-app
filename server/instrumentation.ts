/**
 * Langfuse tracing for the account API.
 *
 * WHY IT EXISTS: `server/api.ts` is the one process in this repo that serves
 * real requests over real HTTP, so it is the only place where "what actually
 * happened on the wire" is a question worth answering after the fact. Langfuse
 * is that answer: every request becomes a trace, grouped by the session the
 * caller carries, so a spec that fails on the third of four round trips can be
 * read back as four traces instead of four lines of stdout.
 *
 * WHY OPENTELEMETRY: the Langfuse JS SDK is an OTEL exporter, not a logger.
 * `LangfuseSpanProcessor` takes the spans the OTEL Node SDK collects and ships
 * them to the project named by the environment. Nothing else here registers
 * instrumentations on purpose - Node's auto-instrumentation would file a span
 * for every socket and every `fs` read, which buries the four spans that mean
 * something (see the note on noise in Langfuse's best-practices guide).
 *
 * WHY IT IS OPTIONAL: the keys live in `.env`, which is git-ignored, so a fresh
 * clone and CI both run without them. Without keys the processor is never
 * constructed and the tracing calls in `api.ts` become no-ops rather than a
 * stream of failed exports - `yarn e2e` must not depend on a Langfuse account.
 *
 * MUST BE IMPORTED FIRST. `api.ts` imports it on its first line: the SDK has to
 * be started before the code being traced runs, and the credentials have to be
 * in `process.env` before this module is evaluated - which is what the
 * `--env-file-if-exists=.env` flag on `yarn api:start` is for.
 */
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

/**
 * Both keys, or nothing. A public key on its own authenticates nothing, and a
 * half-configured processor fails per export rather than at startup.
 */
const configured = Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);

/**
 * The account this server stores is a person: name, email, phone, free-text
 * bio. `api.ts` deliberately never puts those values into a span - it records
 * which fields a request touched, not what they contained. This is the second
 * lock on that door, applied to every attribute on its way out, so a future
 * `span.update({ input: account })` leaks a shape rather than a person.
 *
 * The hook receives the attribute value already serialized to JSON, and returns
 * what should be sent in its place.
 */
function maskPersonalData({ data }: { data: string }): string {
  return data
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "***MASKED_EMAIL***")
    .replace(/\+?\d[\d\s.-]{7,}\d/g, "***MASKED_PHONE***");
}

/**
 * Exported so the shutdown path can flush it. Spans are batched in memory, and
 * this process is killed rather than asked to stop - by Playwright when the run
 * ends, by Ctrl-C in development - which without a flush drops whatever the
 * last few seconds recorded.
 *
 * `null` when the keys are absent, which is what makes tracing optional.
 */
export const langfuseSpanProcessor = configured
  ? new LangfuseSpanProcessor({
      mask: maskPersonalData,
      // Traces from this server are never production traffic. Tagging them
      // keeps them filterable away from anything real that later reports to
      // the same project.
      environment: process.env.LANGFUSE_TRACING_ENVIRONMENT ?? "development",
    })
  : null;

if (langfuseSpanProcessor) {
  const sdk = new NodeSDK({ spanProcessors: [langfuseSpanProcessor] });
  sdk.start();
  console.log("[api] Langfuse tracing enabled");
} else {
  console.log("[api] Langfuse tracing disabled (no LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY)");
}
