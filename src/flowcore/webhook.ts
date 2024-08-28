import axios, { isAxiosError } from "axios"
import { retry } from "radash"

import { EventDto } from "../contracts"
import FlowcorePredicateException from "../exceptions/predicate-exception"
import FlowcoreWebhookSendException from "../exceptions/webhook-send-exception"

import { RedisPredicate, redisPredicateFactory } from "./redis-queue"
import { waitForPredicate } from "./wait-for-predicate"

import { z } from "zod"

export interface WebhookOptions {
  webhook: {
    baseUrl: string
    tenant: string
    dataCore: string
    apiKey: string
    /*How ofter to retry sending the webhook on fail*/
    retryCount?: number
    /*Delay between retries*/
    retryDelayMs?: number | ((count: number) => number)
  }
  localTransform?: {
    /* Skip sending webhook and sends event to local transformer */
    skipWebhook?: boolean
    baseUrl: string
    secret: string
  }
  redisPredicateCheck?: {
    url: string
    keyPrefix: string
    /*How ofter to retry redis predicate on fail*/
    retryCount?: number
    /*Delay between retries*/
    retryDelayMs?: number | ((count: number) => number)
  }
}

export type WebhookSignature<
  TData,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = <TPredicate = unknown>(
  data: TData,
  options?:
    | {
        times?: number | undefined
        delay?: number | undefined
        waitForPredicate?: boolean | undefined
        predicateCheck?: (() => Promise<TPredicate>) | undefined
        predicate?: ((result: TPredicate) => boolean) | undefined
        metadata?: TMetadata | undefined
      }
    | undefined,
) => Promise<string>

/**
 * Sends a webhook to the specified aggregator and event.
 * @param options - The options for the webhook.
 * @param aggregator - The aggregator to send the webhook to.
 * @param event - The event to trigger on the aggregator.
 * @param data - The data to send with the webhook.
 * @param metadata - The metadata to send with the webhook.
 * @returns A promise that resolves when the webhook is sent successfully with the event id.
 * @throws An error if the webhook fails to send.
 */
export async function sendWebhook<T>(
  options: WebhookOptions,
  aggregator: string,
  event: string,
  data: T,
  metadata?: Record<string, unknown>,
) {
  const url = [
    options.webhook.baseUrl,
    "event",
    options.webhook.tenant,
    options.webhook.dataCore,
    aggregator,
    event,
  ].join("/")
  try {
    const headers = {}

    if (metadata) {
      headers["x-flowcore-metadata-json"] = Buffer.from(
        JSON.stringify(metadata),
        "utf-8",
      ).toString("base64")
    }

    const result = options.localTransform?.skipWebhook
      ? {
          data: {
            success: true,
            eventId: "00000000-0000-0000-0000-000000000000",
          } as {
            success: boolean
            eventId?: string
            error?: string
          },
        }
      : await axios.post<{
          success: boolean
          eventId?: string
          error?: string
        }>(url, data, { params: { key: options.webhook.apiKey }, headers })

    if (!result.data.success) {
      throw new FlowcoreWebhookSendException(
        `Expected {"success": true} from response, got {"success": ${result.data.success}}`,
        result.data.error,
        aggregator,
        event,
        data,
      )
    }

    if (!result.data.eventId) {
      throw new FlowcoreWebhookSendException(
        `Missing eventId from response`,
        result.data,
        aggregator,
        event,
        data,
      )
    }

    if (options.localTransform) {
      try {
        const transformerUrl = [
          options.localTransform.baseUrl,
          aggregator,
        ].join("/")

        const localEvent: z.infer<typeof EventDto> = {
          eventId: result.data.eventId,
          aggregator,
          eventType: event,
          validTime: new Date().toISOString(),
          payload: data,
        }

        await axios.post(transformerUrl, localEvent, {
          headers: {
            "X-Secret": options.localTransform.secret,
          },
        })
        console.debug(`Sent to local transformer: ${result.data.eventId}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        throw new FlowcoreWebhookSendException(
          `Failed to send to local transformer: ${message}`,
          error,
          aggregator,
          event,
          data,
        )
      }
    }

    return result.data.eventId
  } catch (error) {
    const message = getMessageFromWebhookError(error)
    throw new FlowcoreWebhookSendException(
      message,
      error,
      aggregator,
      event,
      data,
    )
  }
}

/**
 * Sends a webhook batch to the specified aggregator and event.
 * @param options - The options for the webhook.
 * @param aggregator - The aggregator to send the webhook to.
 * @param event - The event to trigger on the aggregator.
 * @param data - The data[] to send with the webhook.
 * @param metadata - The metadata to send with the webhook.
 * @returns A promise that resolves when the webhook is sent successfully with the event id.
 * @throws An error if the webhook fails to send.
 */
export async function sendWebhookBatch<T>(
  options: WebhookOptions,
  aggregator: string,
  event: string,
  data: T[],
  metadata?: Record<string, unknown>,
) {
  const url = [
    options.webhook.baseUrl,
    "events",
    options.webhook.tenant,
    options.webhook.dataCore,
    aggregator,
    event,
  ].join("/")
  try {
    const headers = {}

    if (metadata) {
      headers["x-flowcore-metadata-json"] = Buffer.from(
        JSON.stringify(metadata),
        "utf-8",
      ).toString("base64")
    }

    const result = options.localTransform?.skipWebhook
      ? {
          data: {
            success: true,
            eventIds: data.map(() => "00000000-0000-0000-0000-000000000000"),
          } as {
            success: boolean
            eventIds?: string[]
            error?: string
          },
        }
      : await axios.post<{
          success: boolean
          eventIds?: string[]
          error?: string
        }>(url, data, { params: { key: options.webhook.apiKey }, headers })

    if (!result.data.success) {
      throw new FlowcoreWebhookSendException(
        `Expected {"success": true} from response, got {"success": ${result.data.success}}`,
        result.data.error,
        aggregator,
        event,
        data,
      )
    }

    if (result.data.eventIds?.length !== data.length) {
      throw new FlowcoreWebhookSendException(
        `Invalid eventIds from response`,
        result.data,
        aggregator,
        event,
        data,
      )
    }

    if (options.localTransform) {
      try {
        const transformerUrl = [
          options.localTransform.baseUrl,
          aggregator,
        ].join("/")

        await Promise.all(
          result.data.eventIds.map((eventId, index) => {
            const localEvent: z.infer<typeof EventDto> = {
              eventId,
              aggregator,
              eventType: event,
              validTime: new Date().toISOString(),
              payload: data[index],
            }
            return axios.post(transformerUrl, localEvent, {
              headers: {
                "X-Secret": options.localTransform?.secret ?? "",
              },
            })
          }),
        )
        console.debug(`Sent to local transformer: ${result.data.eventIds}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        throw new FlowcoreWebhookSendException(
          `Failed to send to local transformer: ${message}`,
          error,
          aggregator,
          event,
          data,
        )
      }
    }

    return result.data.eventIds
  } catch (error) {
    const message = getMessageFromWebhookError(error)
    throw new FlowcoreWebhookSendException(
      message,
      error,
      aggregator,
      event,
      data,
    )
  }
}

/**
 * Returns a function that sends a webhook to the specified aggregator and event with optional metadata and predicate checking.
 *
 * @param {WebhookOptions} webHookOptions - The webhook options including the webhook base URL, tenant, data core, API key, and optional local transformer base URL and Redis URL with event ID key.
 * @return - The webhook factory function that returns a function that sends a webhook with optional predicate checking.
 */
export function webhookFactory(webHookOptions: WebhookOptions) {
  let redisPredicate: RedisPredicate | undefined
  if (webHookOptions.redisPredicateCheck) {
    redisPredicate = redisPredicateFactory({
      redisUrl: webHookOptions.redisPredicateCheck.url,
      redisEventIdKey: webHookOptions.redisPredicateCheck.keyPrefix,
    })
  }

  return <
    TData,
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
  >(
    aggregator: string,
    event: string,
  ) => {
    const send = async <TPredicate = unknown>(
      data: TData,
      options?: {
        /*Skip all predicate checks (redis or custom)*/
        skipPredicateCheck?: boolean
        /*Custom predicate check (skips redis check when defined)*/
        predicateCheck?: () => Promise<TPredicate>
        /*Custom predicate (Only applicable for custom predicate check)*/
        predicate?: (result: TPredicate) => boolean
        retryCount?: number
        retryDelayMs?: number | ((count: number) => number)
        metadata?: TMetadata
      },
    ) => {
      options = {
        retryCount: webHookOptions.redisPredicateCheck?.retryCount ?? 20,
        retryDelayMs: webHookOptions.redisPredicateCheck?.retryDelayMs ?? 250,
        ...options,
      }

      const sendWebhookMethod = () =>
        sendWebhook<TData>(
          webHookOptions,
          aggregator,
          event,
          data,
          options?.metadata,
        )

      const eventId = !webHookOptions.webhook.retryCount
        ? await sendWebhookMethod()
        : await retry(
            {
              times: webHookOptions.webhook.retryCount,
              ...(typeof webHookOptions.webhook.retryDelayMs === "function"
                ? { backoff: webHookOptions.webhook.retryDelayMs }
                : { delay: webHookOptions.webhook.retryDelayMs ?? 250 }),
            },
            sendWebhookMethod,
          )

      if (options?.skipPredicateCheck) {
        return eventId
      }

      try {
        if (!options.predicateCheck) {
          if (!redisPredicate) {
            return eventId
          }
          await redisPredicate(
            eventId,
            options.retryCount,
            options.retryDelayMs,
          )
          return eventId
        }

        if (!options.predicate) {
          options.predicate = (result) => !!result
        }

        await waitForPredicate(
          options.predicateCheck,
          options.predicate,
          options.retryCount,
          options.retryDelayMs,
        )

        return eventId
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        throw new FlowcorePredicateException(
          message,
          error,
          eventId,
          aggregator,
          event,
          data,
        )
      }
    }

    const sendBatch = async <TPredicate = unknown>(
      data: TData[],
      options?: {
        /*Skip all predicate checks (redis or custom)*/
        skipPredicateCheck?: boolean
        /*Custom predicate check (skips redis check when defined)*/
        predicateCheck?: () => Promise<TPredicate>
        /*Custom predicate (Only applicable for custom predicate check)*/
        predicate?: (result: TPredicate) => boolean
        retryCount?: number
        retryDelayMs?: number | ((count: number) => number)
        metadata?: TMetadata
      },
    ) => {
      options = {
        retryCount: webHookOptions.redisPredicateCheck?.retryCount ?? 20,
        retryDelayMs: webHookOptions.redisPredicateCheck?.retryDelayMs ?? 250,
        ...options,
      }

      const sendWebhookMethod = () =>
        sendWebhookBatch<TData>(
          webHookOptions,
          aggregator,
          event,
          data,
          options?.metadata,
        )

      const eventIds = await sendWebhookMethod()

      if (options?.skipPredicateCheck) {
        return eventIds
      }

      try {
        if (!options.predicateCheck) {
          if (!redisPredicate) {
            return eventIds
          }
          await Promise.all(
            eventIds.map((eventId) =>
              redisPredicate?.(
                eventId,
                options?.retryCount,
                options?.retryDelayMs,
              ),
            ),
          )
          return eventIds
        }

        if (!options.predicate) {
          options.predicate = (result) => !!result
        }

        await waitForPredicate(
          options.predicateCheck,
          options.predicate,
          options.retryCount,
          options.retryDelayMs,
        )

        return eventIds
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        throw new FlowcorePredicateException(
          message,
          error,
          eventIds.join(", "),
          aggregator,
          event,
          data,
        )
      }
    }

    return {
      send,
      sendBatch,
    }
  }
}

function getMessageFromWebhookError(error: any): string {
  if (isAxiosError(error)) {
    const data = error.response?.data
    if (
      data !== null &&
      typeof data === "object" &&
      typeof data.message === "string"
    ) {
      return data.message
    }
  } else if (error instanceof Error) {
    return error.message
  }
  return "Unknown error"
}
