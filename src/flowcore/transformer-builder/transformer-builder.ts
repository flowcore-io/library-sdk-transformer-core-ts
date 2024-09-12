import type { Static, TObject, TProperties } from "@sinclair/typebox"
import { Value } from "@sinclair/typebox/value"
import { safeParseType } from "./../../utils/safe-parse-type"
import { TransformerError } from "./exceptions"
import {
  FlowcoreEventSchema,
  type TransformerErrorHandler,
  type TransformerEventHandler,
  type TransformerResponseSchema,
  type TransformerSuccessHandler,
} from "./types"

export class TransformerBuilder<TContext = unknown> {
  protected secret?: string
  protected flowType: string
  private successHandler?: TransformerSuccessHandler
  private errorHandler?: TransformerErrorHandler
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private eventTypes: Record<string, { handler: TransformerEventHandler<any, TContext>; schema: TObject }> = {}

  public constructor(flowType: string) {
    if (!flowType) {
      throw new TransformerError("Flow type is required to construct a transformer")
    }
    this.flowType = flowType
  }

  public withSecret(secret: string): this {
    this.secret = secret
    return this
  }

  public withSuccessHandler(successHandler: TransformerSuccessHandler): this {
    this.successHandler = successHandler
    return this
  }

  public withErrorHandler(errorHandler: TransformerErrorHandler): this {
    this.errorHandler = errorHandler
    return this
  }

  public onEventType<T extends TProperties>(
    eventType: string,
    schema: TObject<T>,
    handler: TransformerEventHandler<Static<typeof schema>, TContext>,
  ): this {
    if (!eventType) {
      throw new TransformerError("Event type is required to construct a transformer")
    }
    this.eventTypes[eventType] = { handler, schema }
    return this
  }

  public getHandler() {
    return (event: unknown, secret?: string) => {
      if (!Value.Check(FlowcoreEventSchema, event)) {
        const errors: Record<string, string> = {}
        const typeboxErrors = Value.Errors(FlowcoreEventSchema, event)
        for (const typeboxError of typeboxErrors) {
          errors[typeboxError.path] = typeboxError.message
        }
        throw new TransformerError("Invalid event", { errors })
      }
      return this.handleEvent(event, secret)
    }
  }

  protected async handleEvent(event: Static<typeof FlowcoreEventSchema>, secret?: string, context?: TContext) {
    const response = await this.processEvent(event, context ?? ({} as TContext), secret)
    this.processResponse(event, response).catch((error) => {
      throw new TransformerError("Failed to run after response handler", {
        exception: error as Error,
      })
    })
    return response
  }

  private async processEvent(
    event: Static<typeof FlowcoreEventSchema>,
    context: TContext,
    secret?: string,
  ): Promise<Static<typeof TransformerResponseSchema>> {
    if (this.secret && this.secret !== secret) {
      return { status: "error", statusCode: 401, message: "Unauthorized" }
    }

    if (event.aggregator !== this.flowType) {
      return { status: "error", message: "Invalid flow type", statusCode: 400 }
    }

    const eventConsumer = this.eventTypes[event.eventType]
    if (!eventConsumer) {
      return {
        status: "error",
        message: "Invalid event type",
        statusCode: 400,
      }
    }

    const payload = event.payload
    if (!Value.Check(eventConsumer.schema, payload)) {
      return {
        status: "error",
        message: "Invalid payload",
        statusCode: 400,
      }
    }

    const parsedPayload = safeParseType(eventConsumer.schema, event.payload)
    if (!parsedPayload.success) {
      return {
        status: "error",
        message: "Invalid payload",
        statusCode: 400,
        errors: parsedPayload.errors,
      }
    }

    try {
      await eventConsumer.handler(parsedPayload.data, event, context)
    } catch (error) {
      throw new TransformerError("Failed to handle event", {
        exception: error as Error,
      })
    }

    return { status: "ok", statusCode: 200 }
  }

  private async processResponse(
    event: Static<typeof FlowcoreEventSchema>,
    response: Static<typeof TransformerResponseSchema>,
  ) {
    if (response.status === "ok") {
      await this.successHandler?.(event, response)
    } else {
      await this.errorHandler?.(event, response)
    }
  }
}
