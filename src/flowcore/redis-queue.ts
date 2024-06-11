import Redis from "ioredis";
import _ from "lodash";

import FlowcorePredicateException from "../exceptions/predicate-exception";

import { waitForPredicate } from "./wait-for-predicate";

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
}

if (!process.env.REDIS_KEY_PATTERN) {
  console.warn(
    `REDIS_KEY_PATTERN not set, using "generic:event-queue" as default`,
  );
}

export const REDIS_EVENT_ID_KEY =
  process.env.REDIS_KEY_PATTERN ?? "generic:event-queue";

export const redisPredicate = async <T>(
  eventId?: string | string[],
  fallback?: () => Promise<T>,
  predicate?: (result: T) => boolean,
  times = 20,
  delay = 250,
) => {
  if (!redis || !eventId) {
    if (!fallback) {
      throw new Error("Redis not available and no fallback provided");
    }

    console.debug("Redis not available, using fallback");

    return waitForPredicate(
      fallback,
      predicate ?? ((result) => !!result),
      times,
      delay,
    ).catch((error) => {
      throw new FlowcorePredicateException(error.message);
    });
  }

  if (eventId instanceof Array) {
    return waitForPredicate(
      async () => {
        const loaded = await Promise.all(
          eventId.map((id) => redis?.get(`${REDIS_EVENT_ID_KEY}:${id}`)),
        );

        return _.every(loaded, (result) => !!result) as unknown as T;
      },
      predicate ?? ((result) => !!result),
      times,
      delay,
    ).catch((error) => {
      throw new FlowcorePredicateException(error.message);
    });
  }

  return waitForPredicate(
    async () => {
      const loaded = await redis?.get(`${REDIS_EVENT_ID_KEY}:${eventId}`);

      return loaded as unknown as T;
    },
    predicate ?? ((result) => !!result),
    times,
    delay,
  ).catch((error) => {
    throw new FlowcorePredicateException(error.message);
  });
};

export const writeToQueue = async (eventId: string) => {
  if (!redis) {
    return;
  }

  await redis.set(`${REDIS_EVENT_ID_KEY}:${eventId}`, "1", "EX", "60");
};
