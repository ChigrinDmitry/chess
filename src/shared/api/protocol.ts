import { z } from 'zod'

/**
 * Протокол партии: всё, что ходит между клиентом и хостом (или сервером). Схемы — единственный
 * источник правды: типы выводятся из них, а транспорты проверяют ими всё, что пришло извне.
 * Типы намеренно структурно совпадают с типами `entities/*` (shared от них не зависит).
 */

const color = z.enum(['w', 'b'])
const promotion = z.enum(['n', 'b', 'r', 'q'])
const square = z.templateLiteral([
  z.enum(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']),
  z.enum(['1', '2', '3', '4', '5', '6', '7', '8']),
])

/** Длина ника ограничена, а набор символов — буквы, цифры, пробел и `_ . ' -` (ТЗ §4). */
export const DISPLAY_NAME_MAX = 24
const displayName = z
  .string()
  .trim()
  .min(1)
  .max(DISPLAY_NAME_MAX)
  .regex(/^[\p{L}\p{N} _.'-]+$/u)

const identity = z.object({
  kind: z.enum(['guest', 'user', 'bot']),
  id: z.string().min(1).max(64),
  displayName,
  avatar: z.object({
    hue: z.number().int().min(0).max(359),
    initials: z.string().min(1).max(3),
  }),
})

const gameResult = z.object({
  result: z.enum(['1-0', '0-1', '1/2-1/2']),
  reason: z.enum([
    'checkmate',
    'timeout',
    'resignation',
    'stalemate',
    'insufficient-material',
    'threefold-repetition',
    'fifty-moves',
    'agreement',
    'timeout-vs-insufficient-material',
  ]),
})

/** Ход в том виде, в каком его присылает игрок. */
const moveInput = z.object({ from: square, to: square, promotion: promotion.optional() })

/** Остатки времени и чьи часы идут на момент отправки сообщения. */
const clockSnapshot = z.object({
  remaining: z.object({ w: z.number().nonnegative(), b: z.number().nonnegative() }),
  running: color.nullable(),
})

const clockState = clockSnapshot.extend({
  config: z.object({ initialMs: z.number().positive(), incrementMs: z.number().nonnegative() }),
})

const errorCode = z.enum([
  'room-full',
  'not-joined',
  'not-started',
  'not-your-turn',
  'illegal-move',
  'game-over',
  'game-not-over',
  'no-draw-offer',
  'takeback-unavailable',
  'unsupported',
])

export const clientMessageSchema = z.discriminatedUnion('type', [
  /** Войти в комнату; повторный `join` — запрос текущего состояния (resync). */
  z.object({ type: z.literal('join'), identity, color: color.optional() }),
  z.object({ type: z.literal('move'), ...moveInput.shape }),
  z.object({ type: z.literal('resign') }),
  z.object({ type: z.literal('offerDraw') }),
  z.object({ type: z.literal('answerDraw'), accept: z.boolean() }),
  z.object({ type: z.literal('rematch') }),
  /** Только против бота. */
  z.object({ type: z.literal('takeback') }),
  z.object({ type: z.literal('ping') }),
])

export const serverMessageSchema = z.discriminatedUnion('type', [
  /** Полное состояние партии: ответ на `join` и любой resync. Персональное (`you`). */
  z.object({
    type: z.literal('state'),
    status: z.enum(['waiting', 'playing', 'over']),
    startFen: z.string(),
    fen: z.string(),
    /** Ходы в SAN от `startFen`. */
    moves: z.array(z.string()),
    /** `null` — партия без часов. */
    clock: clockState.nullable(),
    result: gameResult.nullable(),
    players: z.object({ w: identity.nullable(), b: identity.nullable() }),
    /** Цвета, за которые ходит получатель (в hot-seat — оба). */
    you: z.array(color),
    drawOffer: color.nullable(),
  }),
  z.object({
    type: z.literal('moved'),
    /** Номер полухода (1 — первый ход белых). */
    ply: z.number().int().positive(),
    san: z.string(),
    move: moveInput,
    fen: z.string(),
    clock: clockSnapshot.nullable(),
  }),
  z.object({ type: z.literal('drawOffered'), by: color }),
  z.object({ type: z.literal('drawDeclined') }),
  z.object({ type: z.literal('rematchRequested'), by: color }),
  z.object({
    type: z.literal('gameOver'),
    ...gameResult.shape,
    clock: clockSnapshot.nullable(),
  }),
  z.object({ type: z.literal('opponentPresence'), color, online: z.boolean() }),
  z.object({ type: z.literal('error'), code: errorCode }),
])

export type ProtocolIdentity = z.infer<typeof identity>
export type ClientMessage = z.infer<typeof clientMessageSchema>
export type ServerMessage = z.infer<typeof serverMessageSchema>
export type StateMessage = Extract<ServerMessage, { type: 'state' }>
export type MovedMessage = Extract<ServerMessage, { type: 'moved' }>
export type ProtocolErrorCode = z.infer<typeof errorCode>

/** Разбор входящего сообщения: `null`, если оно не соответствует протоколу. */
export function parseClientMessage(input: unknown): ClientMessage | null {
  const parsed = clientMessageSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseServerMessage(input: unknown): ServerMessage | null {
  const parsed = serverMessageSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}
