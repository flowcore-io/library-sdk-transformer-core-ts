export type FetchResponse<T> = {
  status: number
  statusText: string
  data: T
}

async function send<TResult, TBody = unknown>(
  url: string,
  method: string,
  body: TBody | null,
  headers: Record<string, unknown>,
): Promise<FetchResponse<TResult>> {
  const params: Record<string, unknown> = {
    method,
    headers: headers,
  }

  if (body) {
    params.body = body
  }

  const rawResult = await fetch(url, params)

  try {
    const result = await rawResult.json()

    return {
      status: rawResult.status,
      statusText: rawResult.statusText,
      data: result as TResult,
    }
  } catch (error) {
    return {
      status: 500, // internal server error
      statusText: error instanceof Error ? error.message : String(error),
      data: null as TResult,
    }
  }
}

export function postRaw<TResult, TBody = unknown>(
  url: string,
  body: TBody,
  headers: Record<string, unknown>,
): Promise<FetchResponse<TResult>> {
  return send(url, "POST", body, headers)
}

export function postJson<TResult, TBody = unknown>(
  url: string,
  body: TBody,
  headers: Record<string, unknown>,
): Promise<FetchResponse<TResult>> {
  return send(url, "POST", JSON.stringify(body), {
    "Content-Type": "application/json",
    ...headers,
  })
}
