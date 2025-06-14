import type { Static, TAnySchema } from "@sinclair/typebox"
import { Value } from "@sinclair/typebox/value"
import type { FlowcoreEventSchema } from "../transformer-builder"
import { WebhookLocalTransformerError, WebhookPredicateError, WebhookSendError } from "./exceptions"
import {
  RETRYABLE_STATUS_CODES,
  type Webhook,
  WebhookBatchSuccessResponseSchema,
  type WebhookBuilderOptions,
  WebhookError500ResponseSchema,
  WebhookErrorResponseSchema,
  type WebhookFile,
  type WebhookFileData,
  WebhookFileSuccessResponseSchema,
  type WebhookHeaderOptions,
  type WebhookLocalTransformOptions,
  type WebhookPredicate,
  type WebhookRetryOptions,
  type WebhookSendBatchOptions,
  type WebhookSendOptions,
  WebhookSuccessResponseSchema,
} from "./types"

export class WebhookBuilder {
  private baseUrl: string
  private tenant: string
  private dataCore: string
  private apiKey: string
  private retryOptions?: WebhookRetryOptions
  private predicate?: WebhookPredicate
  private predicateOptions?: WebhookRetryOptions
  private localTransformOptions?: WebhookLocalTransformOptions

  constructor(options: WebhookBuilderOptions) {
    this.baseUrl = options.baseUrl ?? "https://webhook.api.flowcore.io"
    this.tenant = options.tenant
    this.dataCore = options.dataCore
    this.apiKey = options.apiKey
  }

  public withRetry(retryOptions?: WebhookRetryOptions) {
    this.retryOptions = {
      maxAttempts: retryOptions?.maxAttempts ?? this.retryOptions?.maxAttempts ?? 1,
      attemptDelayMs: retryOptions?.attemptDelayMs ?? this.retryOptions?.attemptDelayMs ?? 250,
    }
    return this
  }

  public withPredicate({
    predicate,
    options,
  }: {
    predicate?: WebhookPredicate
    options?: WebhookRetryOptions
  }) {
    this.predicate = predicate ?? this.predicate
    this.predicateOptions = {
      maxAttempts: options?.maxAttempts ?? this.predicateOptions?.maxAttempts ?? 8,
      attemptDelayMs: options?.attemptDelayMs ?? this.predicateOptions?.attemptDelayMs ?? 250,
    }
    return this
  }

  public withLocalTransform(options: WebhookLocalTransformOptions) {
    this.localTransformOptions = {
      baseUrl: options.baseUrl,
      secret: options.secret,
    }
    return this
  }

  public factory() {
    return () => {
      const factory = new WebhookBuilder({
        baseUrl: this.baseUrl,
        tenant: this.tenant,
        dataCore: this.dataCore,
        apiKey: this.apiKey,
      })
      if (this.retryOptions) {
        factory.withRetry(this.retryOptions)
      }
      if (this.predicate) {
        factory.withPredicate({
          predicate: this.predicate,
          options: this.predicateOptions,
        })
      }
      if (this.localTransformOptions) {
        factory.withLocalTransform(this.localTransformOptions)
      }
      return factory
    }
  }

  public buildWebhook<EventPayload, EventMetadata extends Record<string, string> = Record<string, string>>(
    flowType: string,
    eventType: string,
  ): Webhook<EventPayload, EventMetadata> {
    const send = async (payload: EventPayload, metadata?: EventMetadata, options?: WebhookSendOptions) => {
      const rawResponse = await this.fetchWithRetry(this.getUrl(flowType, eventType, "event"), {
        method: "POST",
        headers: this.getHeaders(metadata, { contentType: "application/json", ...options }),
        body: JSON.stringify(payload),
      })
      const response = this.validateWebhookResponse(rawResponse, WebhookSuccessResponseSchema)
      const eventId = response.eventId
      await this.doLocalTransform(flowType, eventType, payload, eventId)
      await this.doPredicateCheck(eventId)
      return eventId
    }

    const sendBatch = async (payload: EventPayload[], metadata?: EventMetadata, options?: WebhookSendBatchOptions) => {
      const rawResponse = await this.fetchWithRetry(this.getUrl(flowType, eventType, "events"), {
        method: "POST",
        headers: this.getHeaders(metadata, { contentType: "application/json", ...options }),
        body: JSON.stringify(payload),
      })
      const response = this.validateWebhookResponse(rawResponse, WebhookBatchSuccessResponseSchema)
      const eventIds = response.eventIds
      if (eventIds.length !== payload.length) {
        throw new WebhookSendError("Webhook batch returned different number of event ids than payloads", { response })
      }
      await Promise.all(
        payload.map((payload, index) => this.doLocalTransform(flowType, eventType, payload, eventIds[index])),
      )
      await this.doPredicateCheck(eventIds)
      return eventIds
    }
    return { send, sendBatch }
  }

  public buildFileWebhook<EventMetadata extends Record<string, string> = Record<string, string>>(
    flowType: string,
    eventType: string,
  ): WebhookFile<EventMetadata> {
    const send = async (payload: WebhookFileData, metadata?: EventMetadata, options?: WebhookSendOptions) => {
      const formData = new FormData()
      // for (const [key, value] of Object.entries(payload.additionalProperties ?? {})) {
      //   formData.append(key, value as string)
      // }
      process.env.DEBUG?.includes("transformer-core") && console.log("additionalProperties", payload.additionalProperties)
      formData.append("additionalProperties", JSON.stringify(payload.additionalProperties ?? "{}"))
      formData.append("fileId", payload.fileId)
      formData.append("type", payload.fileType)
      formData.append("file", payload.fileContent, payload.fileName)
      const rawResponse = await this.fetchWithRetry(this.getUrl(flowType, eventType, "file"), {
        method: "POST",
        headers: this.getHeaders(metadata, options),
        body: formData,
      })
      const response = this.validateWebhookResponse(rawResponse, WebhookFileSuccessResponseSchema)
      const eventIds = response.eventIds
      await this.doPredicateCheck(eventIds)
      return eventIds
    }

    return { send }
  }

  private async doLocalTransform(flowType: string, eventType: string, payload: unknown, eventId?: string) {
    if (!this.localTransformOptions?.baseUrl) {
      return
    }
    const url = `${this.localTransformOptions.baseUrl}/${flowType}`
    const event: Static<typeof FlowcoreEventSchema> = {
      aggregator: flowType,
      eventType,
      payload,
      eventId: eventId ?? "00000000-0000-0000-0000-000000000000",
      validTime: new Date().toISOString(),
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-Secret": this.localTransformOptions.secret ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      })
      if (!response.ok) {
        const responseBody = await response.json()
        throw new WebhookLocalTransformerError("Failed to send event to local transformer", { response: responseBody })
      }
    } catch (error) {
      throw new WebhookLocalTransformerError("Failed to send event to local transformer", { exception: error })
    }
  }

  private validateWebhookResponse<T extends TAnySchema>(response: unknown, responseSchema: T): Static<T> {
    if (Value.Check(WebhookError500ResponseSchema, response)) {
      throw new WebhookSendError("Webhook failed", {
        response,
      })
    }

    if (Value.Check(WebhookErrorResponseSchema, response)) {
      if (response.__localError) {
        throw new WebhookSendError("Webhook failed with exception", {
          exception: response.__localError,
        })
      }
      throw new WebhookSendError("Webhook failed", { response })
    }

    if (!Value.Check(responseSchema, response)) {
      throw new WebhookSendError("Webhook returned invalid response", { response })
    }

    return response
  }

  private async doPredicateCheck(eventIds: string | string[]): Promise<void> {
    if (!this.predicate || !this.predicateOptions) {
      return
    }
    const predicate = this.predicate
    const { maxAttempts, attemptDelayMs } = this.predicateOptions
    let checks: (string | true)[] = Array.isArray(eventIds) ? eventIds : [eventIds]
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        checks = await Promise.all<true | string>(
          checks.map(async (eventId) => {
            if (eventId === true) {
              return true
            }
            const check = (await predicate(eventId)) ?? false
            if (check) {
              return true
            }
            return eventId
          }),
        )

        if (checks.every((check) => check === true)) {
          return
        }
        if (attempt >= maxAttempts) {
          throw new WebhookPredicateError("Predicate check failed", {
            eventIds: Array.isArray(eventIds) ? eventIds : [eventIds],
          })
        }
      } catch (error) {
        if (attempt >= maxAttempts) {
          if (error instanceof WebhookPredicateError) {
            throw error
          }
          throw new WebhookPredicateError("Predicate check failed with exception", {
            eventIds: Array.isArray(eventIds) ? eventIds : [eventIds],
            exception: error,
          })
        }
      }
      await sleep(attemptDelayMs, attempt)
    }
    throw new WebhookPredicateError("Predicate check failed", {
      eventIds: Array.isArray(eventIds) ? eventIds : [eventIds],
    })
  }

  private async fetchWithRetry(url: string, options: RequestInit) {
    const { maxAttempts, attemptDelayMs } = this.retryOptions ?? { maxAttempts: 1, attemptDelayMs: 0 }
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, options)
        if (response.ok) {
          return response.json().catch((error) => {
            return {
              success: false,
              message: "Failed to parse response",
              error: error instanceof Error ? error.message : "Unknown error",
            }
          })
        }
        if (!RETRYABLE_STATUS_CODES.includes(response.status) || attempt >= maxAttempts) {
          return response.json().catch((error) => {
            return {
              success: false,
              message: "Failed to parse error response",
              error: error instanceof Error ? error.message : "Unknown error",
            }
          })
        }
        await sleep(attemptDelayMs, attempt)
      } catch (error) {
        if (attempt >= maxAttempts) {
          return {
            success: false,
            message: "Failed with local exception",
            error: error instanceof Error ? error.message : "Unknown error",
            __localError: error,
          } as Static<typeof WebhookErrorResponseSchema>
        }
        await sleep(attemptDelayMs, attempt)
      }
    }
  }

  private getHeaders(metadata?: Record<string, string>, options?: WebhookHeaderOptions) {
    const headers = {
      Authorization: `${this.apiKey}`,
      ...(options?.contentType ? { "Content-Type": options.contentType } : {}),
      ...(options?.eventTime ? { "x-flowcore-event-time": options.eventTime.toISOString() } : {}),
      ...(options?.validTime ? { "x-flowcore-valid-time": options.validTime.toISOString() } : {}),
      ...(options?.eventTimeKey ? { "x-flowcore-event-time-key": options.eventTimeKey } : {}),
      ...(options?.validTimeKey ? { "x-flowcore-valid-time-key": options.validTimeKey } : {}),
      ...(metadata
        ? { "x-flowcore-metadata-json": Buffer.from(JSON.stringify(metadata), "utf-8").toString("base64") }
        : {}),
    }
    return headers
  }

  private getUrl(flowType: string, eventType: string, type: "event" | "events" | "file") {
    return `${this.baseUrl}/${type}/${this.tenant}/${this.dataCore}/${flowType}/${eventType}`
  }
}

function sleep(ms: number | ((attempt: number) => number), attempt = 1) {
  return new Promise((resolve) => setTimeout(resolve, typeof ms === "function" ? ms(attempt) : ms))
}
