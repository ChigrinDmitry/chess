import type { IncomingMessage } from 'node:http'
import { z } from 'zod'

const MAX_BODY_BYTES = 1024

/** Пределы контроля времени: от 1 секунды до 3 часов на партию, добавка — до 5 минут. */
export const createGameBody = z.object({
  clock: z
    .object({
      initialMs: z
        .number()
        .int()
        .min(1_000)
        .max(3 * 60 * 60_000),
      incrementMs: z
        .number()
        .int()
        .min(0)
        .max(5 * 60_000),
    })
    .nullable(),
})

export type CreateGameBody = z.infer<typeof createGameBody>

export class BodyTooLargeError extends Error {}

/** Читает JSON-тело запроса; `undefined` — тело не JSON. Слишком большое тело обрывает. */
export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new BodyTooLargeError()
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}
