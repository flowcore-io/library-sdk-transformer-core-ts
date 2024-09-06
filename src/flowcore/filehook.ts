import { retry } from "radash"

import { postRaw } from "./http"
import { type RedisPredicate, redisPredicateFactory } from "./redis-queue"
import { waitForPredicate } from "./wait-for-predicate"

export type FilehookData = {
  fileId: string
  fileName: string
  fileType: string
  fileContent: Blob
  metadata?: Record<string, string>
}

export interface FilehookOptions {
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
  redisPredicateCheck?: {
    url: string
    keyPrefix: string
    /*How ofter to retry redis predicate on fail*/
    retryCount?: number
    /*Delay between retries*/
    retryDelayMs?: number | ((count: number) => number)
  }
}

/**
 * Sends a file to the Flowcore filehook to the specified aggregator and event.
 * @param aggregator - The aggregator to send the webhook to.
 * @param event - The event to trigger on the aggregator.
 * @param data - The data to send with the webhook.
 * @returns A promise that resolves when the webhook is sent successfully.
 * @throws An error if the webhook fails to send.
 */
export async function sendFilehook(
  filehookOptions: FilehookOptions,
  aggregator: string,
  event: string,
  data: FilehookData,
) {
  const url = [
    filehookOptions.webhook.baseUrl,
    "file",
    filehookOptions.webhook.tenant,
    filehookOptions.webhook.dataCore,
    aggregator,
    event,
  ].join("/")
  try {
    const formData = new FormData()

    if (data.metadata) {
      // biome-ignore lint/complexity/noForEach: <explanation>
      Object.entries(data.metadata).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }

    formData.append("fileId", data.fileId)
    formData.append("type", data.fileType)
    formData.append("file", data.fileContent, data.fileName)

    const result = await postRaw<{
      checksum: string
      eventIds?: string[]
    }>(url, formData, {
      Authorization: `${filehookOptions.webhook.apiKey}`,
    })

    if (!result.data?.checksum) {
      console.error("Failed to send filehook")
      throw new Error("Failed to send filehook")
    }

    return result.data?.eventIds
  } catch (error) {
    console.error("Failed to send filehook", error instanceof Error ? error.message : error)
    throw new Error("Failed to send filehook")
  }
}

/**
 * Returns a function that creates a filehook with specified options and sends it based on aggregator and event.
 *
 * @param {FilehookOptions} filehookOptions - The options for creating the filehook including the Redis URL and event ID key.
 * @return {(aggregator: string, event: string) =>
 *  (data: FilehookData, options?: {
 *    times?: number;
 *    delay?: number;
 *    waitForPredicate?: boolean;
 *    predicateCheck?: () => Promise<unknown>;
 *    predicate?: (result: unknown) => boolean;
 * }) => Promise<string>} - The filehook factory function that creates and sends a filehook with optional predicate checking.
 */
export function filehookFactory(filehookOptions: FilehookOptions) {
  let redisPredicate: RedisPredicate | undefined
  if (filehookOptions.redisPredicateCheck) {
    redisPredicate = redisPredicateFactory({
      redisUrl: filehookOptions.redisPredicateCheck.url,
      redisEventIdKey: filehookOptions.redisPredicateCheck.keyPrefix,
    })
  }
  return (aggregator: string, event: string) => {
    return async <TPredicate = unknown>(
      data: FilehookData,
      _options?: {
        /*Skip all predicate checks (redis or custom)*/
        skipPredicateCheck?: boolean
        /*Custom predicate check (skips redis check when defined)*/
        predicateCheck?: () => Promise<TPredicate>
        /*Custom predicate (Only applicable for custom predicate check)*/
        predicate?: (result: TPredicate) => boolean
        retryCount?: number
        retryDelayMs?: number | ((count: number) => number)
      },
    ) => {
      const options = {
        retryCount: filehookOptions.webhook.retryCount ?? 20,
        retryDelayMs: filehookOptions.webhook.retryDelayMs ?? 250,
        ..._options,
      }

      const sendFileHookMethod = () => sendFilehook(filehookOptions, aggregator, event, data)

      const eventIds = !filehookOptions.webhook.retryCount
        ? await sendFileHookMethod()
        : await retry(
            {
              times: filehookOptions.webhook.retryCount,
              ...(typeof filehookOptions.webhook.retryDelayMs === "function"
                ? { backoff: filehookOptions.webhook.retryDelayMs }
                : { delay: filehookOptions.webhook.retryDelayMs ?? 250 }),
            },
            sendFileHookMethod,
          )

      if (options.skipPredicateCheck) {
        return eventIds
      }

      if (!options.predicateCheck) {
        if (!redisPredicate || !eventIds || !eventIds.length) {
          return eventIds
        }
        await redisPredicate(eventIds, options.retryCount, options.retryDelayMs)
        return eventIds
      }

      if (!options.predicate) {
        options.predicate = (result) => !!result
      }

      await waitForPredicate(options.predicateCheck, options.predicate, options.retryCount, options.retryDelayMs)

      return eventIds
    }
  }
}
