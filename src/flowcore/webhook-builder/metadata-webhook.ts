export const metadataWebhook =
  <TMetadata extends Record<string, unknown> = Record<string, unknown>>(metadata: TMetadata) =>
  async <TData, TReturnType extends string | string[]>(
    webhook: (data: TData, metadata?: TMetadata) => Promise<TReturnType>,
    payload: Parameters<typeof webhook>[0],
    additionalMetadata?: Parameters<typeof webhook>[1],
  ) => {
    const augmentedMetadata = {
      ...additionalMetadata,
      ...metadata,
    }
    return webhook(payload, augmentedMetadata) as ReturnType<typeof webhook>
  }
