import { WebhookSignature } from "./webhook"

export const metadataWebhookFactory = <
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  metadata: TMetadata,
) => {
  return async <TData>(
    webhook: WebhookSignature<TData, TMetadata>,
    parameters: Parameters<WebhookSignature<TData, TMetadata>>[0],
    options?: Parameters<WebhookSignature<TData, TMetadata>>[1],
  ) => {
    const optionsWithMetadata = {
      ...options,
      metadata: {
        ...metadata,
        ...options?.metadata,
      },
    } as Record<string, unknown>

    return webhook(parameters, optionsWithMetadata) as Promise<string>
  }
}
