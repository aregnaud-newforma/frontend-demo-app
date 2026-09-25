using System.Diagnostics;
using Npgsql;
using OpenTelemetry;
using OpenTelemetry.Context.Propagation;
using OpenTelemetry.Exporter;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Accounts;

/// <summary>
/// This service's Datadog APM, beside SentrySetup.cs rather than instead of it.
/// </summary>
public static class DatadogSetup
{
    /// <summary>
    /// Traces for the account API, sent to the local Datadog Agent, and the
    /// middle of a trace that starts in the browser's RUM and ends in the
    /// notifications service.
    ///
    /// <para>
    /// THROUGH OPENTELEMETRY, NOT DATADOG'S OWN TRACER. That tracer attaches to
    /// the runtime as a CLR profiler, and it ships no macOS build - which is
    /// where `yarn start` runs this. OpenTelemetry is portable, and the Agent
    /// ingests it over OTLP (compose.yaml). Its twin on the Node side is
    /// <c>../Notifications/datadog.ts</c>, which uses dd-trace for the opposite
    /// reason; docs/adr/0008 says why the two differ.
    /// </para>
    ///
    /// <para>
    /// HOW IT JOINS THE BROWSER'S TRACE. RUM writes a W3C <c>traceparent</c> on
    /// every call to <c>/api/</c> (apps/shell/src/datadog.ts), the Vite proxy
    /// forwards it, and the ASP.NET Core instrumentation continues the trace it
    /// names. The HttpClient instrumentation writes it on again for the
    /// notifications service. Nothing else is propagated: <c>baggage</c> is
    /// Sentry's, and carries its sampling decision (docs/adr/0004), so this side
    /// neither reads nor writes it - see <see cref="TraceContextOnly"/>.
    /// </para>
    ///
    /// <para>
    /// Off unless <c>DD_AGENT_HOST</c> is set, the one variable that turns APM on
    /// for both services (../../.env.example). CI sets none, so nothing here
    /// runs there. The sampler is OpenTelemetry's default, which follows the
    /// parent's decision - the browser's - and records everything else. The
    /// Agent drops the health polls (compose.yaml), which is the job Sentry's
    /// <c>TracesSampler</c> does on its side.
    /// </para>
    /// </summary>
    public static void AddDatadogTracing(this WebApplicationBuilder builder)
    {
        if (Environment.GetEnvironmentVariable("DD_AGENT_HOST") is not { Length: > 0 } agentHost)
        {
            return;
        }

        // Both the runtime's propagator and OpenTelemetry's, because each owns
        // half of the job: ASP.NET Core reads the incoming headers and HttpClient
        // writes the outgoing ones through the runtime's, while OpenTelemetry's
        // API goes through its own. Left at their defaults, both would carry
        // `baggage` - reading Sentry's off the request and writing a second copy
        // onto the call to the notifications service.
        DistributedContextPropagator.Current = new TraceContextOnly();
        Sdk.SetDefaultTextMapPropagator(new TraceContextPropagator());

        builder.Services.AddOpenTelemetry()
            // The words Sentry uses, so one search finds this service in either
            // tool: `service` is SentrySetup.cs's tag, `environment` is lowercased
            // the same way, and `version` is the same SENTRY_RELEASE the browser's
            // RUM reports as its version (vite.base.ts).
            .ConfigureResource(resource => resource
                .AddService(
                    "account-api",
                    serviceVersion: Environment.GetEnvironmentVariable("SENTRY_RELEASE") is { Length: > 0 } release
                        ? release
                        : null)
                .AddAttributes([
                    new("deployment.environment.name", builder.Environment.EnvironmentName.ToLowerInvariant()),
                ]))
            .WithTracing(tracing => tracing
                // An unhandled exception as an event on the request's span, with
                // its type, message and stack - what Datadog's Error Tracking
                // groups an issue by. Without it the span is only marked errored
                // by its 500, and Sentry.AspNetCore is the only one that sees why.
                .AddAspNetCoreInstrumentation(aspNetCore => aspNetCore.RecordException = true)
                // The call to the notifications service and nothing else. The
                // Sentry SDK sends its envelopes through HttpClient too, and
                // every upload would otherwise be a span in the trace it is
                // reporting.
                .AddHttpClientInstrumentation(http => http.FilterHttpRequestMessage = request =>
                    request.RequestUri is { } uri && NotificationsClient.BaseAddress.IsBaseOf(uri))
                .AddNpgsql()
                .AddOtlpExporter(otlp =>
                {
                    otlp.Endpoint = new Uri($"http://{agentHost}:4318/v1/traces");
                    otlp.Protocol = OtlpExportProtocol.HttpProtobuf;
                }));
    }

    /// <summary>
    /// The runtime's W3C propagator with the <c>baggage</c> half taken out.
    ///
    /// <para>
    /// .NET's default reads <c>baggage</c> into the request's Activity and
    /// writes it back onto every outgoing HttpClient call. Sentry.AspNetCore
    /// already forwards that header itself, so the default would send the
    /// notifications service two of them. This keeps <c>traceparent</c> and
    /// <c>tracestate</c> and leaves <c>baggage</c> to Sentry alone.
    /// </para>
    /// </summary>
    private sealed class TraceContextOnly : DistributedContextPropagator
    {
        private readonly DistributedContextPropagator inner = CreateW3CPropagator();

        public override IReadOnlyCollection<string> Fields { get; } = ["traceparent", "tracestate"];

        public override void Inject(Activity? activity, object? carrier, PropagatorSetterCallback? setter)
        {
            if (activity is null || setter is null || activity.IdFormat != ActivityIdFormat.W3C)
            {
                return;
            }
            setter(carrier, "traceparent", activity.Id!);
            if (activity.TraceStateString is { Length: > 0 } traceState)
            {
                setter(carrier, "tracestate", traceState);
            }
        }

        public override void ExtractTraceIdAndState(
            object? carrier,
            PropagatorGetterCallback? getter,
            out string? traceId,
            out string? traceState) =>
            inner.ExtractTraceIdAndState(carrier, getter, out traceId, out traceState);

        public override IEnumerable<KeyValuePair<string, string?>>? ExtractBaggage(
            object? carrier,
            PropagatorGetterCallback? getter) => null;
    }
}
