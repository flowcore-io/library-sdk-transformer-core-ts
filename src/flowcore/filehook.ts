import axios from "axios";
import { retry } from "radash";

import { RedisPredicate, redisPredicateFactory } from "./redis-queue";
import { waitForPredicate } from "./wait-for-predicate";

export type FilehookData = {
  fileId: string;
  fileName: string;
  fileType: string;
  fileContent: Blob;
  metadata?: Record<string, string>;
};

export interface FilehookOptions {
  webhookBaseUrl: string;
  tenant: string;
  dataCore: string;
  apiKey: string;
  redisUrl?: string;
  redisEventIdKey?: string;
  webhookRetryCount?: number;
  webhookRetryDelay?: number;
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
    filehookOptions.webhookBaseUrl,
    "file",
    filehookOptions.tenant,
    filehookOptions.dataCore,
    aggregator,
    event,
  ].join("/");
  try {
    const formData = new FormData();

    if (data.metadata) {
      Object.entries(data.metadata).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    formData.append("fileId", data.fileId);
    formData.append("type", data.fileType);
    formData.append("file", data.fileContent, data.fileName);

    const result = await axios.post<{
      checksum: string;
      eventIds?: string[];
    }>(url, formData, {
      headers: { Authorization: `${filehookOptions.apiKey}` },
    });

    if (!result.data.checksum) {
      console.error("Failed to send filehook");
      throw new Error("Failed to send filehook");
    }

    return result.data.eventIds;
  } catch (error) {
    console.error(
      "Failed to send filehook",
      error instanceof Error ? error.message : error,
    );
    throw new Error("Failed to send filehook");
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
  let redisPredicate: RedisPredicate | undefined;
  if (filehookOptions.redisUrl && filehookOptions.redisEventIdKey) {
    redisPredicate = redisPredicateFactory({
      redisUrl: filehookOptions.redisUrl,
      redisEventIdKey: filehookOptions.redisEventIdKey,
    });
  }
  return (aggregator: string, event: string) => {
    return async <TPredicate = unknown>(
      data: FilehookData,
      options?: {
        times?: number;
        delay?: number;
        waitForPredicate?: boolean;
        predicateCheck?: () => Promise<TPredicate>;
        predicate?: (result: TPredicate) => boolean;
      },
    ) => {
      options = {
        times: 20,
        delay: 250,
        waitForPredicate: true,
        ...options,
      };

      const sendFileHookMethod = () => sendFilehook(
        filehookOptions,
        aggregator,
        event,
        data,
      )

      const eventIds = !filehookOptions.webhookRetryCount 
        ? await sendFileHookMethod() 
        : await retry({
          times: filehookOptions.webhookRetryCount, 
          delay: filehookOptions.webhookRetryDelay ?? 250
        }, sendFileHookMethod);

      if (!options.waitForPredicate) {
        return eventIds;
      }

      if (!options.predicateCheck) {
        if (!redisPredicate || !eventIds || !eventIds.length) {
          return eventIds;
        }
        await redisPredicate(eventIds, options.times, options.delay);
        return eventIds;
      }

      if (!options.predicate) {
        options.predicate = (result) => !!result;
      }

      await waitForPredicate(
        options.predicateCheck,
        options.predicate,
        options.times,
        options.delay,
      );

      return eventIds;
    };
  };
}
