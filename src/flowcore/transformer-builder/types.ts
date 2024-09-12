import { type Static, Type } from "@sinclair/typebox"

export const FlowcoreEventSchema = Type.Object(
  {
    eventId: Type.String(),
    aggregator: Type.String(),
    eventType: Type.String(),
    validTime: Type.String({ pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,3})?Z$" }),
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

export type TransformerEventHandler<T, TContext = unknown> = (
  payload: T,
  event: Static<typeof FlowcoreEventSchema>,
  context?: TContext,
) => Promise<void>

export type TransformerSuccessHandler = (
  event: Static<typeof FlowcoreEventSchema>,
  response: Static<typeof TransformerResponseSchema>,
) => Promise<unknown>

export type TransformerErrorHandler = (
  event: Static<typeof FlowcoreEventSchema>,
  response: Static<typeof TransformerResponseSchema>,
) => Promise<unknown>
