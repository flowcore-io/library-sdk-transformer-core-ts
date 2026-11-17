import type { Static, TAnySchema } from "@sinclair/typebox"
import { Value } from "@sinclair/typebox/value"
import type { FlowcoreEventSchema } from "../transformer-builder"
import { checkAbort, drain, sleep, withSignal } from "./cancellation"
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
    const send = async (payload: EventPayload, metadata?: EventMetadata, options?: WebhookSendOptions) =>
      withSignal(options?.signal, async (signal) => {
        checkAbort(signal)
        const { signal: _signal, ...headerOptions } = options ?? {}
        const rawResponse = await this.fetchWithRetry(this.getUrl(flowType, eventType, "event"), {
          method: "POST",
          signal,
          headers: this.getHeaders(metadata, { contentType: "application/json", ...headerOptions }),
          body: JSON.stringify(payload),
        })
        checkAbort(signal)
        const response = this.validateWebhookResponse(rawResponse, WebhookSuccessResponseSchema)
        const eventId = response.eventId
        await this.doLocalTransform(flowType, eventType, payload, signal, eventId)
        await this.doPredicateCheck(eventId, signal, options?.signal !== undefined)
        checkAbort(signal)
        return eventId
      })

    const sendBatch = async (payload: EventPayload[], metadata?: EventMetadata, options?: WebhookSendBatchOptions) =>
      withSignal(options?.signal, async (signal) => {
        checkAbort(signal)
        const { signal: _signal, ...headerOptions } = options ?? {}
        const rawResponse = await this.fetchWithRetry(this.getUrl(flowType, eventType, "events"), {
          method: "POST",
          signal,
          headers: this.getHeaders(metadata, { contentType: "application/json", ...headerOptions }),
          body: JSON.stringify(payload),
        })
        checkAbort(signal)
        const response = this.validateWebhookResponse(rawResponse, WebhookBatchSuccessResponseSchema)
        const eventIds = response.eventIds
        if (eventIds.length !== payload.length) {
          throw new WebhookSendError("Webhook batch returned different number of event ids than payloads", { response })
        }
        await drain(
          payload.map((payload, index) => ({ payload, eventId: eventIds[index] })),
          signal,
          ({ payload, eventId }, branchSignal) =>
            this.doLocalTransform(flowType, eventType, payload, branchSignal, eventId),
        )
        await this.doPredicateCheck(eventIds, signal, options?.signal !== undefined)
        checkAbort(signal)
        return eventIds
      })
    return { send, sendBatch }
  }

  public buildFileWebhook<EventMetadata extends Record<string, string> = Record<string, string>>(
    flowType: string,
    eventType: string,
  ): WebhookFile<EventMetadata> {
    const send = async (payload: WebhookFileData, metadata?: EventMetadata, options?: WebhookSendOptions) =>
      withSignal(options?.signal, async (signal) => {
        checkAbort(signal)
        const formData = new FormData()
        formData.append("additionalProperties", JSON.stringify(payload.additionalProperties ?? "{}"))
        formData.append("fileId", payload.fileId)
        formData.append("type", payload.fileType)
        formData.append("file", payload.fileContent, payload.fileName)
        checkAbort(signal)
        const { signal: _signal, ...headerOptions } = options ?? {}
        const rawResponse = await this.fetchWithRetry(this.getUrl(flowType, eventType, "file"), {
          method: "POST",
          signal,
          headers: this.getHeaders(metadata, headerOptions),
          body: formData,
        })
        checkAbort(signal)
        const response = this.validateWebhookResponse(rawResponse, WebhookFileSuccessResponseSchema)
        const eventIds = response.eventIds
        await this.doPredicateCheck(eventIds, signal, options?.signal !== undefined)
        checkAbort(signal)
        return eventIds
      })

    return { send }
  }

  private async doLocalTransform(
    flowType: string,
    eventType: string,
    payload: unknown,
    signal: AbortSignal,
    eventId?: string,
  ) {
    checkAbort(signal)
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
    const body = JSON.stringify(event)
    checkAbort(signal)
    try {
      const response = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          "X-Secret": this.localTransformOptions.secret ?? "",
          "Content-Type": "application/json",
        },
        body,
      })
      try {
        checkAbort(signal)
        if (!response.ok) {
          const responseBody = await response.json()
          checkAbort(signal)
          throw new WebhookLocalTransformerError("Failed to send event to local transformer", {
            response: responseBody,
          })
        }
        // A successful local transform has no response payload contract. Dispose its body.
      } finally {
        await response.body?.cancel().catch(() => undefined)
      }
      checkAbort(signal)
    } catch (error) {
      checkAbort(signal)
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

  private async doPredicateCheck(
    eventIds: string | string[],
    signal: AbortSignal,
    stopOnError: boolean,
  ): Promise<void> {
    checkAbort(signal)
    if (!this.predicate || !this.predicateOptions) {
      return
    }
    const predicate = this.predicate
    const { maxAttempts, attemptDelayMs } = this.predicateOptions
    let checks: (string | true)[] = Array.isArray(eventIds) ? eventIds : [eventIds]
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        checks = await drain(checks, signal, async (eventId, branchSignal): Promise<true | string> => {
          if (eventId === true) {
            return true
          }
          checkAbort(branchSignal)
          const check = (await predicate(eventId, branchSignal)) ?? false
          checkAbort(branchSignal)
          if (check) {
            return true
          }
          return eventId
        })
        checkAbort(signal)

        if (checks.every((check) => check === true)) {
          return
        }
        if (attempt >= maxAttempts) {
          throw new WebhookPredicateError("Predicate check failed", {
            eventIds: Array.isArray(eventIds) ? eventIds : [eventIds],
          })
        }
      } catch (error) {
        if (stopOnError) throw error
        checkAbort(signal)
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
      await sleep(attemptDelayMs, attempt, signal)
    }
    throw new WebhookPredicateError("Predicate check failed", {
      eventIds: Array.isArray(eventIds) ? eventIds : [eventIds],
    })
  }

  private async fetchWithRetry(url: string, options: RequestInit & { signal: AbortSignal }) {
    const { signal } = options
    const { maxAttempts, attemptDelayMs } = this.retryOptions ?? { maxAttempts: 1, attemptDelayMs: 0 }
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      checkAbort(signal)
      try {
        const response = await fetch(url, options)
        try {
          checkAbort(signal)
          if (response.ok || !RETRYABLE_STATUS_CODES.includes(response.status) || attempt >= maxAttempts) {
            try {
              const body: unknown = await response.json()
              checkAbort(signal)
              return body
            } catch (error) {
              checkAbort(signal)
              return {
                success: false,
                message: response.ok ? "Failed to parse response" : "Failed to parse error response",
                error: error instanceof Error ? error.message : "Unknown error",
              }
            }
          }
        } finally {
          // Retryable responses need not be read, but their bodies must be released.
          await response.body?.cancel().catch(() => undefined)
        }
      } catch (error) {
        checkAbort(signal)
        if (attempt >= maxAttempts) {
          return {
            success: false,
            message: "Failed with local exception",
            error: error instanceof Error ? error.message : "Unknown error",
            __localError: error,
          } as Static<typeof WebhookErrorResponseSchema>
        }
      }
      checkAbort(signal)
      await sleep(attemptDelayMs, attempt, signal)
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
