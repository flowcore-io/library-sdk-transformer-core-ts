import { z } from "zod"

export const EventDto = z.object({
  eventId: z.string(),
  aggregator: z.string(),
  eventType: z.string(),
  validTime: z.string(),
  payload: z.any(),
  metadata: z.record(z.any()).optional(),
})

export const EventMetadataDto = EventDto.omit({
  payload: true,
})

export type EventMetdata = z.infer<typeof EventMetadataDto>
