# sdk-transformer-core

A core library that facilitates writing transformers and business logic services that utilise the flowcore paradigm

## Installation

install with npm:

```bash
npm install @flowcore/refine-data-provider
```

or yarn:

```bash
yarn add @flowcore/refine-data-provider
```

## Usage

## Development

```bash
yarn install
```

or with npm:

```bash
npm install
```

### Transformer builder
#### Usage exampe
```ts
new TransformerBuilder("flow-type.0")
    .withSecret("SUPER_SECRET_STRING")
    // Execute after succsessfully handling and responding to an event
    .withSuccessHandler(async (event: FlowcoreEvent) => {
        // Handle success
    })
    .onEventType(
        "event-type.0",
        EventTypePayloadSchema,
        async (event: FlowcoreEvent, payload: Static<typeof EventTypePayloadSchema>) => {
            // Handle event
        }
    )
    // ... (add more onEventType)
    // Get a generic handler method
    .getHandler()
    // Returns
    // (event: unknown, secret?: string) => Promise<{status: "ok" | "error", statusCode: number, message?: string, errors?: Record<string, string>}>

// You can extend the builder to build for specific routers

// Elysia example
export class ElysiaTransformerBuilder extends TransformerBuilder {
  public getRouter() {
    return new Elysia().post(
      `/${this.flowType}`,
      async ({ body, headers, set }) => {
        const response = await this.handleEvent(body, headers["x-secret"])
        set.status = response.statusCode
        return response
      },
      {
        body: FlowcoreEventSchema,
        headers: TransformerHeadersSchema,
        response: TransformerResponseSchema,
      },
    )
  }
}

```
### Webhook builder
#### Usage example
```ts
const webhookFactory = new WebhookBuilder({
  // Base URL of webhook ingestion (default: "https://webhook.api.flowcore.io")
  baseUrl: "https://webhook.api.flowcore.io",
  // Required: flowcore tenant name
  tenant: "tenant",
  // Required: data core name or uuid
  dataCore: "data-core",
  // Required: flowcore api key
  apiKey: "00000000-0000-0000-0000-000000000000",
})
    // Will attempt X times to send webhook if it fails with a retryable status code
    // Retryable status codes are: 408, 429, 500, 502, 503, 504
    .withRetry({
        // Maximum number of attempts (default: 1)
        maxAttempts: 1,
        // Delay between attempts (default: 250)
        attemptDelayMs: 250,
        // Can also be a backoff method
        // attemptDelayMs: (attempt: number) => number
    })
    // Will do a predicate check after event is sent
    .withPredicate({
        // Predicate method: (eventId: string) => Promise<boolean> | boolean
        predicate: (eventId: string) => checkEventId(eventId)
        // Predicate options
        options: {
            // Maximum number of predicate attempts
            maxAttempts: 8,
            // Delay betweeen predicate attempts
            attemptDelayMs: 250,
            // Can also be a backoff method
            // attemptDelayMs: (attempt: number) => number
        }
    })
    // Build webhook method
    .buildWebhook<EventPayload extends Record<string, unknown>, MetaData extends Record<string, unknown>>("flow-type.0", "event-type.0")
    // Returns
    //{
    //    send: (payload: EventPayload, metadata?: MetaData, options?: WebhookSendOptions) => Promise<string>,
    //    sendBatch: (payload: EventPayload[], metadata?: MetaData, options?: WebhookSendBatchOptions) => Promise<string>,
    //}
    .buildFileWebhook<MetaData extends Record<string, unknown>>("flow-type.0", "event-type.0")
    // Returns
    //{
    //    send: (payload: FilePayload, metadata?: MetaData, options?: WebhookSendOptions) => Promise<string>,
    //}
    // Can also be used as a factory
    .factory()
    // Returns a method that returns a new instance of WebhookBuilder with current options
    // () => WebhookBuilder
```
### Returns and Exception handling
`webhook.send` returns a single eventId (`string`)
`webhook.sendBatch` and `fileWebhook.send` return an array of eventIds (`string[]`)

When send methods fail you can get these exceptions
`WebhookSendError {message: string, response?: unknown, exception?: Error}`
- `response` is the return from the webhook endpoint (send failed on webhook endpoint)
- `exception` is the locally thrown exception (send failed locally with an exception)

`WebhookPredicateError` {message: string, eventIds: string[], exception?: Error}`
- `eventIds` the event ids returned from the webhook endpoint
- `exception` is the locally thrown exception (predicate failed with exception)

`Error`
- Whoopsy... uncaught exception
### Metadata factory
```ts
const webhookWithMetadata = metadataWebhook({
  userId: "123",
})

// Will inject metadata into the sent event
const eventId: string = await webhookWithMetadata(webhook.send, {foo: "bar"})
// Will inject metadata into the sent events
const eventIds: string[] = await webhookWithMetadata(webhook.sendBatch, {foo: "bar"})
// Will inject metadata into the sent event
const eventIds: string[] = await webhookWithMetadata(fileWebhook.send, {foo: "bar"})
```


### Per-call cancellation

`send`, `sendBatch` and file `send` accept an optional `signal: AbortSignal` in
their existing options argument. `withPredicate` callbacks may accept a second,
optional signal argument. Existing one-argument callbacks still work.

```typescript
const controller = new AbortController()
const pending = webhook.send(payload, metadata, { signal: controller.signal })
controller.abort() // await pending before releasing resources owned by this write
await pending
```

A pre-aborted call sends nothing and invokes no predicate or local transform.
Cancellation stops new requests, retries and predicate polls. It reaches ingestion
and local-transform fetches, response bodies and retry delays. Owned bodies are
consumed or cancelled, and retry timers and caller listeners are removed.
The original caller reason is rejected in-process, with `AbortError` when no
reason is available. Signal and reason never enter headers, payloads or diagnostics.
Callers must also avoid logging a caught private reason.

Batch cancellation is partial. Requests already accepted remotely remain accepted,
and a lost acknowledgement does not prove that no event was sent. Retain the same
business intent for recovery; cancellation does not retract events or authorize a
new business timestamp. An already completed send may win before a later abort.

Every started callback and batch branch drains before public rejection. A first
branch failure cancels sibling owned transports and gates late callback results.
With a supplied signal, a thrown predicate error is terminal after drain; a false
predicate result still uses its configured poll/backoff policy. With signal omitted,
predicate exception retries retain their existing behavior, after draining the
failed attempt. Independent writes are unaffected.

An uncooperative predicate can delay settlement without bound. Synchronous
serialization and event-loop stalls cannot be interrupted either. There is no
implicit deadline or detached timeout race. A successful local-transform response
has no body contract; its unused body is cancelled rather than awaited indefinitely.

Pathways consumers must propagate the signal through session resolvers, file/chunk
preparation and confirmation. The complete `isProcessed` operation is potentially
mutating, including lazy DDL, expiry cleanup and lookup. Stop new polls on abort,
then drain all started native/custom store operations before rejecting. An
uncancellable store can wait without bound. Pathways owns this behavior and its
DDL/DELETE, not this SDK. `fireAndForget` must skip confirmation while still awaiting
native ingestion. No shared pump/store closure, application migration or direct
write fallback is implied. See accepted support Plan
[d740e260-70df-4ae9-9b95-56fb2164a944](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/d740e260-70df-4ae9-9b95-56fb2164a944).
