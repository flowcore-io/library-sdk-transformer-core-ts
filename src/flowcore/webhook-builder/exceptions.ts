export class WebhookSendError extends Error {
  public readonly name: string = "WebhookSendError"
  public readonly response: unknown
  public readonly exception?: unknown

  constructor(
    message: string,
    options?: {
      response?: unknown
      exception?: unknown
    },
  ) {
    const errorMessage = options?.exception ? `${message} (${options.exception})` : message
    super(errorMessage)
    this.response = options?.response
    this.exception = options?.exception
  }
}

export class WebhookLocalTransformerError extends Error {
  public readonly name: string = "WebhookLocalTransformerError"
  public readonly exception?: unknown
  public readonly response?: unknown

  constructor(message: string, options?: { exception?: unknown; response?: unknown }) {
    const errorMessage = options?.exception ? `${message} (${options.exception})` : message
    super(errorMessage)
    this.exception = options?.exception
    this.response = options?.response
  }
}

export class WebhookPredicateError extends Error {
  public readonly name: string = "WebhookPredicateError"
  public readonly exception?: unknown
  public readonly eventIds?: string[]

  constructor(
    message: string,
    options: {
      eventIds: string[]
      exception?: unknown
    },
  ) {
    const errorMessage = options?.exception ? `${message} (${options.exception})` : message
    super(errorMessage)
    this.exception = options?.exception
    this.eventIds = options?.eventIds
  }
}
