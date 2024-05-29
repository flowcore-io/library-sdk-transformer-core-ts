import axios from "axios";
import * as process from "process";
import { redisPredicate } from "./redis-queue";
import { waitForPredicate } from "./wait-for-predicate";

export type FilehookData = {
  fileId: string;
  fileName: string;
  fileType: string;
  fileContent: Blob;
  metadata?: Record<string, string>;
};

/**
 * Sends a file to the Flowcore filehook to the specified aggregator and event.
 * @param aggregator - The aggregator to send the webhook to.
 * @param event - The event to trigger on the aggregator.
 * @param data - The data to send with the webhook.
 * @returns A promise that resolves when the webhook is sent successfully.
 * @throws An error if the webhook fails to send.
 */
export async function sendFilehook(
  aggregator: string,
  event: string,
  data: FilehookData,
) {
  const url = [
    process.env.FLOWCORE_WEBHOOK_BASEURL,
    "file",
    process.env.FLOWCORE_TENANT,
    process.env.FLOWCORE_DATACORE,
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
      headers: { Authorization: `${process.env.FLOWCORE_KEY}` },
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
 * Creates a filehook factory function.
 *
 * @param aggregator - The aggregator for the filehook.
 * @param event - The event for the filehook.
 * @param options - The options for the filehook factory.
 * @param options.times - The maximum number of times to retry the predicate check. Default is 20.
 * @param options.delay - The delay in milliseconds between each retry. Default is 250ms.
 * @param options.waitForPredicate - Whether to wait for the predicate to be satisfied. Default is true.
 * @param options.predicateCheck - The function that returns a promise to be evaluated.
 * @param options.predicate - The function that determines if the result satisfies the condition.
 * @returns A function that sends a filehook with the specified aggregator, event ids for each part of the file
 * @template TPredicate - The type of predicate to be checked.
 */
export function filehookFactory(aggregator: string, event: string) {
  return async <TPredicate = unknown>(
    data: FilehookData,
    options?: {
      times: number;
      delay: number;
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

    const eventIds = await sendFilehook(aggregator, event, data);

    if (!options.waitForPredicate) {
      return eventIds;
    }

    if (!options.predicateCheck) {
      await redisPredicate(
        eventIds,
        undefined,
        undefined,
        options.times,
        options.delay,
      );

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
}
