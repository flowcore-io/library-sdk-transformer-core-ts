import Redis from "ioredis"

import { waitForPredicate } from "./wait-for-predicate"

export interface RedisPredicateOptions {
  redisUrl: string
  redisEventIdKey: string
}

export type RedisQueueWriter = (eventId: string) => Promise<void>

export type RedisPredicate = (
  eventId: string | string[],
  times?: number,
  delay?: number,
) => Promise<void>

export function redisPredicateFactory(
  options: RedisPredicateOptions,
): RedisPredicate {
  const redis = new Redis(options.redisUrl)
  return async (eventId?: string | string[], times = 20, delay = 250) => {
    if (!eventId || eventId.length === 0) {
      return
    }
    const eventIds: string[] = Array.isArray(eventId) ? eventId : [eventId]
    return waitForPredicate(
      async () => {
        const loaded = await Promise.all(
          eventIds.map((id) => redis?.get(`${options.redisEventIdKey}:${id}`)),
        )

        return loaded.every((result) => !!result)
      },
      (result) => !!result,
      times,
      delay,
    )
  }
}

export function redisQueueWriterFactory(
  options: RedisPredicateOptions,
): RedisQueueWriter {
  const redis = new Redis(options.redisUrl)
  return async (eventId: string) => {
    await redis.set(`${options.redisEventIdKey}:${eventId}`, "1", "EX", "60")
  }
}
