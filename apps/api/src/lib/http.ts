import { ZodSchema } from "zod"

export function parseBody<T>(schema: ZodSchema<T>, value: unknown) {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.flatten(),
    }
  }

  return {
    ok: true as const,
    data: parsed.data,
  }
}
