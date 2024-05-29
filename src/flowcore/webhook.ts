import axios from "axios";
import { redisPredicate } from "./redis-queue";
import { waitForPredicate } from "./wait-for-predicate";

/**
 * Sends a webhook to the specified aggregator and event.
 * @param aggregator - The aggregator to send the webhook to.
 * @param event - The event to trigger on the aggregator.
 * @param data - The data to send with the webhook.
 * @returns A promise that resolves when the webhook is sent successfully with the event id.
 * @throws An error if the webhook fails to send.
 */
export async function sendWebhook<T>(
  aggregator: string,
  event: string,
  data: T,
) {
  const url = [
    process.env.FLOWCORE_WEBHOOK_BASEURL,
    "event",
    process.env.FLOWCORE_TENANT,
    process.env.FLOWCORE_DATACORE,
    aggregator,
    event,
  ].join("/");
  try {
    const result = await axios.post<{
      success: boolean;
      eventId?: string;
      error?: string;
    }>(url, data, { params: { key: process.env.FLOWCORE_KEY } });

    if (!result.data.success || !result.data.eventId) {
      console.error("Failed to send webhook", result.data.error);
      throw new Error("Failed to send webhook");
    }

    return result.data.eventId;
  } catch (error) {
    console.error(
      "Failed to send webhook",
      error instanceof Error ? error.message : error,
    );
    throw new Error("Failed to send webhook");
  }
}

/**
 * Creates a webhook factory function.
 *
 * @param aggregator - The aggregator for the webhook.
 * @param event - The event for the webhook.
 * @param options - The options for the webhook factory.
 * @param options.times - The maximum number of times to retry the predicate check. Default is 20.
 * @param options.delay - The delay in milliseconds between each retry. Default is 250ms.
 * @param options.waitForPredicate - Whether to wait for the predicate to be satisfied. Default is true.
 * @param options.predicateCheck - The function that returns a promise to be evaluated.
 * @returns A function that sends a webhook with the specified aggregator, event, and data.
 * @template TData - The type of data to be sent in the webhook.
 * @template TPredicate - The type of the predicate to be checked.
 */
export function webhookFactory<TData>(aggregator: string, event: string) {
  return async <TPredicate = unknown>(
    data: TData,
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
      ...(options && { options }),
    };

    const eventId = await sendWebhook<TData>(aggregator, event, data);

    if (!options.waitForPredicate) {
      return eventId;
    }

    if (!options.predicateCheck) {
      await redisPredicate(
        eventId,
        undefined,
        undefined,
        options.times,
        options.delay,
      );

      return eventId;
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

    return eventId;
  };
}
