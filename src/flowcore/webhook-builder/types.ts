import { Type } from "@sinclair/typebox"

export const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]

export const WebhookSuccessResponseSchema = Type.Object({
  eventId: Type.String(),
})

export const WebhookBatchSuccessResponseSchema = Type.Object({
  eventIds: Type.Array(Type.String()),
})

export const WebhookFileSuccessResponseSchema = Type.Object({
  checksum: Type.String(),
  hashType: Type.String(),
  eventIds: Type.Array(Type.String()),
})

export const WebhookErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
  __localError: Type.Optional(Type.Any()),
})

export const WebhookError500ResponseSchema = Type.Object({
  statusCode: Type.Literal(500),
  message: Type.String(),
})

export const WebhookResponseSchema = Type.Union([WebhookSuccessResponseSchema, WebhookErrorResponseSchema])

export const WebhookBatchResponseSchema = Type.Union([WebhookBatchSuccessResponseSchema, WebhookErrorResponseSchema])

export const WebhookFileResponseSchema = Type.Union([WebhookFileSuccessResponseSchema, WebhookErrorResponseSchema])

export interface WebhookBuilderOptions {
  baseUrl?: string
  tenant: string
  dataCore: string
  apiKey: string
}

export interface WebhookRetryOptions {
  maxAttempts: number
  attemptDelayMs: number | ((attempt: number) => number)
}

export interface WebhookLocalTransformOptions {
  baseUrl: string
}

export interface WebhookSendOptions {
  eventTime?: Date
  validTime?: Date
}

export interface WebhookSendBatchOptions {
  eventTimeKey?: string
  validTimeKey?: string
}

export interface WebhookHeaderOptions extends WebhookSendOptions, WebhookSendBatchOptions {
  contentType?: string
}

export interface WebhookFileData {
  fileId: string
  fileName: string
  fileType: string
  fileContent: Blob
  metadata?: Record<string, string>
}

export type WebhookPredicate = (eventId: string) => Promise<boolean> | boolean
