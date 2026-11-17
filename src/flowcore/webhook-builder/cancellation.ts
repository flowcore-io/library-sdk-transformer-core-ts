/** Cancellation stays in-process. Never wrap, serialize or log its reason. */
export function checkAbort(signal?: AbortSignal | null): void {
  if (signal?.aborted) {
    throw signal.reason === undefined ? new DOMException("The operation was aborted", "AbortError") : signal.reason
  }
}

export async function withSignal<T>(signal: AbortSignal | undefined, work: (signal: AbortSignal) => Promise<T>) {
  checkAbort(signal)
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener("abort", abort, { once: true })
  try {
    checkAbort(signal)
    const result = await work(controller.signal)
    checkAbort(controller.signal)
    return result
  } finally {
    signal?.removeEventListener("abort", abort)
  }
}

/** First failure stops owned siblings; every started promise drains before rejection. */
export async function drain<T, R>(items: T[], signal: AbortSignal, work: (item: T, signal: AbortSignal) => Promise<R>) {
  return withSignal(signal, async (groupSignal) => {
    const controller = new AbortController()
    let failed = false
    let cause: unknown
    const fail = (error: unknown) => {
      if (!failed) {
        failed = true
        cause = error
        controller.abort(error)
      }
    }
    const abort = () => fail(groupSignal.reason)
    groupSignal.addEventListener("abort", abort, { once: true })
    try {
      checkAbort(groupSignal)
      const started = items.map(async (item) => {
        try {
          checkAbort(controller.signal)
          const result = await work(item, controller.signal)
          checkAbort(controller.signal)
          return result
        } catch (error) {
          fail(error)
          throw error
        }
      })
      const results = await Promise.allSettled(started)
      if (failed) throw cause
      checkAbort(groupSignal)
      return results.map((result) => (result as PromiseFulfilledResult<R>).value)
    } finally {
      groupSignal.removeEventListener("abort", abort)
    }
  })
}

export async function sleep(ms: number | ((attempt: number) => number), attempt: number, signal: AbortSignal) {
  checkAbort(signal)
  const delay = typeof ms === "function" ? ms(attempt) : ms
  checkAbort(signal)
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      signal.removeEventListener("abort", abort)
    }
    const abort = () => {
      cleanup()
      try {
        checkAbort(signal)
      } catch (error) {
        reject(error)
      }
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, delay)
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
  })
  checkAbort(signal)
}
