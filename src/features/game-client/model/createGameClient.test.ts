import type { ClockConfig } from '@/entities/clock'
import type { PlayerIdentity } from '@/entities/player'
import {
  createLocalRoom,
  type ClientMessage,
  type GameTransport,
  type ServerMessage,
  type StateMessage,
  type TransportStatus,
} from '@/shared/api'
import { createGameClient, type GameClient } from './createGameClient'

const identity = (id: string, name: string): PlayerIdentity => ({
  kind: 'guest',
  id,
  displayName: name,
  avatar: { hue: 100, initials: name.slice(0, 1) },
})
const ANNA = identity('anna', 'Анна')
const BORIS = identity('boris', 'Борис')
const ONE_MINUTE: ClockConfig = { initialMs: 60_000, incrementMs: 1000 }

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

const sans = (client: GameClient) => client.game.getState().moves.map((m) => m.san)

/** Клиент на транспорте, которым управляет тест: видно отправленное и можно подсунуть любое сообщение хоста. */
function scripted(initial?: StateMessage) {
  const sent: ClientMessage[] = []
  let handler: (msg: ServerMessage) => void = () => {}
  let onStatus: (status: TransportStatus) => void = () => {}
  const transport: GameTransport = {
    connect: () => Promise.resolve(),
    disconnect: () => {},
    send: (msg) => void sent.push(msg),
    subscribe: (h) => {
      handler = h
      return () => {}
    },
    onStatusChange: (h) => {
      onStatus = h
      return () => {}
    },
  }
  const client = createGameClient({
    transport,
    gameId: 'room',
    identity: ANNA,
    ...(initial ? { initial } : {}),
  })
  client.start()
  const joins = () => sent.filter((m) => m.type === 'join').length
  return { client, sent, joins, receive: (msg: ServerMessage) => handler(msg), onStatus }
}

const state = (patch: Partial<StateMessage> = {}): StateMessage => ({
  type: 'state',
  status: 'playing',
  startFen: START,
  fen: START,
  moves: [],
  clock: null,
  result: null,
  players: { w: ANNA, b: BORIS },
  you: ['w'],
  drawOffer: null,
  ...patch,
})

const moved = (ply: number, san: string, fen: string, move = { from: 'e2', to: 'e4' }) =>
  ({ type: 'moved', ply, san, move, fen, clock: null }) as ServerMessage

describe('расхождение с хостом', () => {
  it('start отправляет join один раз и передаёт желаемый цвет', () => {
    const { sent } = scripted()
    expect(sent).toEqual([{ type: 'join', identity: ANNA }])
  })

  it('сообщает об изменении статуса соединения', () => {
    const { client, onStatus } = scripted()
    onStatus('reconnecting')
    expect(client.store.getState().connection).toBe('reconnecting')
  })

  it('начальное состояние применяется сразу, до подключения', () => {
    const client = createGameClient({
      transport: createLocalRoom().createClient(),
      gameId: 'room',
      identity: ANNA,
      initial: state({ clock: { config: ONE_MINUTE, remaining: { w: 1, b: 2 }, running: null } }),
    })
    expect(client.store.getState()).toMatchObject({ synced: true, you: ['w'] })
    expect(client.store.getState().clock?.getState().remaining).toEqual({ w: 1, b: 2 })
  })

  it('пропущенный ход → resync', () => {
    const { receive, joins } = scripted(state())
    receive(state())
    const before = joins()
    receive(moved(3, 'Nf3', AFTER_E4))
    expect(joins()).toBe(before + 1)
  })

  it('ход хоста, который не сходится с позицией, → resync', () => {
    const { receive, joins } = scripted()
    receive(state())
    const before = joins()
    receive(moved(1, 'e4', 'not-a-fen'))
    expect(joins()).toBe(before + 1)

    // Нелегальный на нашей позиции ход
    receive(state())
    receive(moved(1, 'Ra5', 'x', { from: 'a1', to: 'a5' }))
    expect(joins()).toBe(before + 2)
  })

  it('чужой ход на месте оптимистичного → resync, потом позиция хоста', () => {
    const { client, receive, joins } = scripted()
    receive(state({ you: ['w'] }))
    client.move({ from: 'e2', to: 'e4' })
    const before = joins()

    receive(moved(1, 'd4', 'x', { from: 'd2', to: 'd4' }))
    expect(joins()).toBe(before + 1)

    receive(
      state({ moves: ['d4'], fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1' }),
    )
    expect(sans(client)).toEqual(['d4'])
  })

  it('отклонённый ход: ошибка запоминается и запрашивается resync', () => {
    const { client, receive, joins } = scripted()
    receive(state())
    client.move({ from: 'e2', to: 'e4' })
    const before = joins()

    receive({ type: 'error', code: 'not-your-turn' })
    expect(client.store.getState().error).toBe('not-your-turn')
    expect(joins()).toBe(before + 1)

    receive({ type: 'error', code: 'room-full' })
    expect(joins()).toBe(before + 1)
  })

  it('нелегальный список ходов в state помечает реплику расхождением', () => {
    const { client, receive } = scripted()
    receive(state({ moves: ['e5'] }))
    expect(client.store.getState().desynced).toBe(true)
    expect(sans(client)).toEqual([])

    receive(state({ moves: ['e4'], fen: 'подмена' }))
    expect(client.store.getState().desynced).toBe(true)

    receive(state({ moves: ['e4'], fen: AFTER_E4 }))
    expect(client.store.getState().desynced).toBe(false)
  })

  it('gameOver применяет исход, не трогая ходы', () => {
    const { client, receive } = scripted()
    receive(state({ moves: ['e4'], fen: AFTER_E4 }))
    receive({ type: 'gameOver', result: '1-0', reason: 'timeout', clock: null })
    expect(client.game.getState().result).toEqual({ result: '1-0', reason: 'timeout' })
    expect(client.store.getState().status).toBe('over')
    expect(sans(client)).toEqual(['e4'])
  })

  it('присутствие и запрос реванша', () => {
    const { client, receive } = scripted()
    receive({ type: 'opponentPresence', color: 'b', online: true })
    receive({ type: 'opponentPresence', color: 'b', online: false })
    receive({ type: 'opponentPresence', color: 'w', online: true })
    expect(client.store.getState().presence).toEqual({ w: true, b: false })

    receive({ type: 'rematchRequested', by: 'b' })
    expect(client.store.getState().rematchRequestedBy).toBe('b')
    receive(state())
    expect(client.store.getState().rematchRequestedBy).toBeNull()
  })

  it('часы исчезают, если хост прислал партию без часов', () => {
    const { client, receive } = scripted()
    receive(state({ clock: { config: ONE_MINUTE, remaining: { w: 1, b: 1 }, running: null } }))
    expect(client.store.getState().clock).not.toBeNull()
    receive(state())
    expect(client.store.getState().clock).toBeNull()
  })

  it('соединение, которое не удалось открыть, помечается закрытым', async () => {
    const transport = createLocalRoom().createClient()
    transport.connect = () => Promise.reject(new Error('нет сети'))
    const client = createGameClient({ transport, gameId: 'room', identity: ANNA })
    client.start()
    await Promise.resolve()
    await Promise.resolve()
    expect(client.store.getState().connection).toBe('closed')
  })
})
