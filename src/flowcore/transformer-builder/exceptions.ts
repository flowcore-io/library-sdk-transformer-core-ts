export class TransformerError extends Error {
  public readonly name = "TransformerError"
  public exception?: Error
  public errors?: Record<string, string>

  constructor(message: string, options?: { exception?: Error; errors?: Record<string, string> }) {
    const errorMessage = options?.exception ? `${message} (${options.exception.message})` : message
    super(errorMessage)
    this.exception = options?.exception
    this.errors = options?.errors
  }
}
