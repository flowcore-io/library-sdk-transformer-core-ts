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

