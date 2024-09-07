import { type Static, Type } from "@sinclair/typebox"

export const FlowcoreEventSchema = Type.Object(
  {
    eventId: Type.String(),
    aggregator: Type.String(),
    eventType: Type.String(),
    validTime: Type.String({ format: "date-time" }),
    payload: Type.Unknown(),
  },
  {
    $id: "FlowcoreEvent",
  },
)

export const TransformerHeadersSchema = Type.Object(
  {
    "x-secret": Type.Optional(Type.String()),
  },
  {
    $id: "TransformerHeaders",
  },
)

export const TransformerResponseSchema = Type.Union(
  [
    Type.Object({
      status: Type.Literal("ok"),
      statusCode: Type.Literal(200),
    }),
    Type.Object({
      status: Type.Literal("error"),
      statusCode: Type.Number(),
      message: Type.String(),
    }),
    Type.Object({
      status: Type.Literal("error"),
      statusCode: Type.Literal(400),
      message: Type.String(),
      errors: Type.Optional(Type.Record(Type.String(), Type.String())),
    }),
  ],
  {
    $id: "TransformerResponse",
  },
)

export type TransformerEventHandler<T> = (event: Static<typeof FlowcoreEventSchema>, payload: T) => Promise<void>

export type TransformerSuccessHandler = (
  event: Static<typeof FlowcoreEventSchema>,
  response: Static<typeof TransformerResponseSchema>,
) => Promise<unknown>

export type TransformerErrorHandler = (
  event: Static<typeof FlowcoreEventSchema>,
  response: Static<typeof TransformerResponseSchema>,
) => Promise<unknown>
