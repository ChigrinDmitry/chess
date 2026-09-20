/** Интеграция: реальные хост и клиенты в одной комнате (композиция происходит в `app`). */
import type { ClockConfig } from '@/entities/clock'
import type { PlayerIdentity } from '@/entities/player'
import { createGameHost } from '@/features/host-game'
import { createLocalRoom } from '@/shared/api'
import { createGameClient, type GameClient } from '@/features/game-client'

const identity = (id: string, name: string): PlayerIdentity => ({
  kind: 'guest',
  id,
  displayName: name,
  avatar: { hue: 100, initials: name.slice(0, 1) },
})
const ANNA = identity('anna', 'Анна')
const BORIS = identity('boris', 'Борис')
const ONE_MINUTE: ClockConfig = { initialMs: 60_000, incrementMs: 1000 }

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

const sans = (client: GameClient) => client.game.getState().moves.map((m) => m.san)

/** Хост и два клиента в одной комнате. */
function table(options: { clock?: ClockConfig | null } = {}) {
  const room = createLocalRoom()
  const host = createGameHost({ transport: room.host, clock: options.clock ?? null })
  host.start()
  const make = (who: PlayerIdentity) =>
    createGameClient({ transport: room.createClient(), gameId: 'room', identity: who })
  const anna = make(ANNA)
  const boris = make(BORIS)
  anna.start()
  boris.start()
  return { room, host, anna, boris }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('подключение и посадка', () => {
  it('после start получает состояние: место, соперника и присутствие', () => {
    const { anna, boris } = table()
    expect(anna.store.getState()).toMatchObject({
      connection: 'open',
      synced: true,
      status: 'playing',
      you: ['w'],
      players: { w: ANNA, b: BORIS },
      presence: { w: true, b: true },
    })
    expect(boris.store.getState().you).toEqual(['b'])
  })

  it('до подключения соперника партия ждёт', () => {
    const room = createLocalRoom()
    createGameHost({ transport: room.host, clock: null }).start()
    const client = createGameClient({
      transport: room.createClient(),
      gameId: 'room',
      identity: ANNA,
      color: 'b',
    })
    expect(client.store.getState()).toMatchObject({ synced: false, connection: 'closed' })
    client.start()
    expect(client.store.getState()).toMatchObject({
      status: 'waiting',
      you: ['b'],
      presence: { w: false, b: true },
    })
  })

  it('stop отключает, повторный start подключает снова', () => {
    const { anna, boris } = table()
    anna.stop()
    expect(anna.store.getState().connection).toBe('closed')
    expect(boris.store.getState().presence.w).toBe(false)

    anna.start()
    expect(anna.store.getState()).toMatchObject({ connection: 'open', you: ['w'] })
    expect(boris.store.getState().presence.w).toBe(true)
  })

  it('повторные start и stop безопасны', () => {
    const { anna } = table()
    anna.start()
    anna.stop()
    anna.stop()
    expect(anna.store.getState().connection).toBe('closed')
  })
})

describe('ходы', () => {
  it('ход оптимистично виден сразу и доходит до соперника', () => {
    const { anna, boris } = table()
    expect(anna.move({ from: 'e2', to: 'e4' })).toBe(true)
    expect(sans(anna)).toEqual(['e4'])
    expect(sans(boris)).toEqual(['e4'])
    expect(boris.game.getState().fen).toBe(AFTER_E4)
  })

  it('не даёт ходить не в свой ход, за чужой цвет и нелегально', () => {
    const { anna, boris } = table()
    expect(boris.move({ from: 'e7', to: 'e5' })).toBe(false)
    expect(anna.move({ from: 'e2', to: 'e5' })).toBe(false)
    expect(anna.move({ from: 'e7', to: 'e5' })).toBe(false)
    expect(sans(anna)).toEqual([])
    expect(anna.store.getState().error).toBeNull()
  })

  it('не ходит, пока состояние не пришло', () => {
    const client = createGameClient({
      transport: createLocalRoom().createClient(),
      gameId: 'room',
      identity: ANNA,
    })
    expect(client.move({ from: 'e2', to: 'e4' })).toBe(false)
  })

  it('превращение передаётся хосту и соперник видит фигуру', () => {
    const { anna, boris } = table()
    const line = [
      ['h2', 'h4'],
      ['g7', 'g5'],
      ['h4', 'g5'],
      ['h7', 'h6'],
      ['g5', 'h6'],
      ['f8', 'g7'],
      ['h6', 'g7'],
      ['a7', 'a6'],
    ] as const
    line.forEach(([from, to], i) => (i % 2 === 0 ? anna : boris).move({ from, to }))
    anna.move({ from: 'g7', to: 'h8', promotion: 'q' })
    expect(sans(boris).at(-1)).toBe('gxh8=Q')
  })

  it('мат: у обоих результат', () => {
    const { anna, boris } = table()
    anna.move({ from: 'f2', to: 'f3' })
    boris.move({ from: 'e7', to: 'e5' })
    anna.move({ from: 'g2', to: 'g4' })
    boris.move({ from: 'd8', to: 'h4' })
    expect(anna.game.getState().result).toEqual({ result: '0-1', reason: 'checkmate' })
    expect(boris.store.getState().status).toBe('over')
    expect(boris.game.getState().result?.reason).toBe('checkmate')
  })
})

describe('сдача, ничья, реванш', () => {
  it('сдача: у обоих итог, статус over', () => {
    const { anna, boris } = table()
    anna.move({ from: 'e2', to: 'e4' })
    boris.resign()
    expect(anna.game.getState().result).toEqual({ result: '1-0', reason: 'resignation' })
    expect(boris.store.getState().status).toBe('over')
  })

  it('ничья: предложение доходит до соперника, ход его снимает', () => {
    const { anna, boris } = table()
    anna.offerDraw()
    expect(boris.store.getState().drawOffer).toBe('w')
    expect(anna.store.getState().drawOffer).toBe('w')

    boris.answerDraw(false)
    expect(anna.store.getState().drawOffer).toBeNull()

    anna.offerDraw()
    anna.move({ from: 'e2', to: 'e4' })
    expect(boris.store.getState().drawOffer).toBeNull()
  })

  it('принятая ничья заканчивает партию', () => {
    const { anna, boris } = table()
    anna.offerDraw()
    boris.answerDraw(true)
    expect(anna.game.getState().result).toEqual({ result: '1/2-1/2', reason: 'agreement' })
  })

  it('реванш: запрос виден сопернику, после согласия — новая партия с другими цветами', () => {
    const { anna, boris } = table({ clock: ONE_MINUTE })
    anna.move({ from: 'e2', to: 'e4' })
    anna.resign()

    anna.rematch()
    expect(boris.store.getState().rematchRequestedBy).toBe('w')
    boris.rematch()

    expect(anna.store.getState()).toMatchObject({
      status: 'playing',
      you: ['b'],
      rematchRequestedBy: null,
    })
    expect(anna.game.getState()).toMatchObject({ moves: [], result: null })
    expect(boris.store.getState().you).toEqual(['w'])
    expect(boris.move({ from: 'd2', to: 'd4' })).toBe(true)
  })

  it('отмена хода против человека отклоняется, партия не меняется', () => {
    const { anna } = table()
    anna.move({ from: 'e2', to: 'e4' })
    anna.takeback()
    expect(anna.store.getState().error).toBe('unsupported')
    expect(sans(anna)).toEqual(['e4'])
  })
})

describe('часы', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  it('часы создаются по состоянию хоста и идут после первого хода', () => {
    const { anna, boris } = table({ clock: ONE_MINUTE })
    const clock = anna.store.getState().clock
    expect(clock?.getState()).toMatchObject({
      config: ONE_MINUTE,
      remaining: { w: 60_000, b: 60_000 },
      running: null,
    })

    anna.move({ from: 'e2', to: 'e4' })
    expect(boris.store.getState().clock?.getState().running).toBe('b')
    vi.advanceTimersByTime(4000)
    boris.move({ from: 'e7', to: 'e5' })
    expect(anna.store.getState().clock?.getState()).toMatchObject({
      remaining: { w: 60_000, b: 57_000 },
      running: 'w',
    })
  })

  it('без часов — clock: null', () => {
    const { anna } = table()
    expect(anna.store.getState().clock).toBeNull()
  })

  it('флаг: итог приходит от хоста, часы стоят', () => {
    const { anna, boris } = table({ clock: ONE_MINUTE })
    anna.move({ from: 'e2', to: 'e4' })
    boris.move({ from: 'e7', to: 'e5' })
    vi.advanceTimersByTime(61_000)

    expect(boris.game.getState().result).toEqual({ result: '0-1', reason: 'timeout' })
    expect(boris.store.getState().clock?.getState()).toMatchObject({
      running: null,
      remaining: { w: 0 },
    })
  })

  it('повторный state с теми же настройками не пересоздаёт часы', () => {
    const { anna } = table({ clock: ONE_MINUTE })
    const before = anna.store.getState().clock
    anna.resync()
    expect(anna.store.getState().clock).toBe(before)
  })
})
