/**
 * Throws a safe error with the provided message and error.
 * If the error is an instance of Error, the error message is appended to the provided message.
 * If the error is not an instance of Error, a generic error message is appended to the provided message.
 *
 * @param message - The message to be included in the error.
 * @param error - The error object.
 * @throws Always throws an error.
 * @returns This function does not return a value.
 */
export const throwSafeError = (message: string, error: unknown): never => {
  if (error instanceof Error) {
    throw new Error(`${message}: ${error.message}`)
  } else {
    // Error might not be an instance of Error, handle accordingly
    throw new Error(`${message}: an unexpected error type`)
  }
}
