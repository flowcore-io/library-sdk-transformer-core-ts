import type { Static, TObject, TProperties } from "@sinclair/typebox"
import { Value } from "@sinclair/typebox/value"

export interface SafeParseTypeSuccess<T extends TProperties> {
  success: true
  data: Static<TObject<T>>
}

export interface SafeParseTypeError {
  success: false
  errors: Record<string, string>
}

export type SafeParseTypeResult<T extends TProperties> = SafeParseTypeSuccess<T> | SafeParseTypeError

export function safeParseType<T extends TProperties>(schema: TObject<T>, value: unknown): SafeParseTypeResult<T> {
  const parsedValue = Value.Convert(schema, Value.Clean(schema, Value.Default(schema, structuredClone(value))))
  if (!Value.Check(schema, parsedValue)) {
    const typeboxErrors = Value.Errors(schema, parsedValue)
    const errors: Record<string, string> = {}
    for (const typeboxError of typeboxErrors) {
      errors[typeboxError.path] = typeboxError.message
    }
    return {
      success: false,
      errors: errors,
    }
  }
  return {
    success: true,
    data: parsedValue as Static<typeof schema>,
  }
}
