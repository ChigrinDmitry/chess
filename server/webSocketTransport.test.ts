// @vitest-environment node
import {
  createWebSocketClient,
  type GameTransport,
  type ProtocolIdentity,
  type ServerMessage,
  type TransportStatus,
  type WebSocketTransportOptions,
} from '@/shared/api'
import { createChessServer, type ChessServer } from './app'
import type { RoomRegistryOptions } from './rooms/roomRegistry'

const identity = (id: string): ProtocolIdentity => ({
  kind: 'guest',
  id,
  displayName: id,
  avatar: { hue: 10, initials: id.slice(0, 2).toUpperCase() },
})

const tokenOf = (id: string) => `secret-of-${id}-0123456789`

interface Probe {
  transport: GameTransport
  messages: ServerMessage[]
  statuses: TransportStatus[]
  sockets: WebSocket[]
  waitFor(predicate: (msg: ServerMessage) => boolean): Promise<ServerMessage>
}

const FAST: WebSocketTransportOptions['reconnect'] = { baseMs: 5, maxMs: 20 }

describe('WebSocketTransport', () => {
  let server: ChessServer | null = null
  let port = 0
  const probes: Probe[] = []

  const start = async (options: RoomRegistryOptions = {}) => {
    server = createChessServer(options)
    port = await server.listen(0, '127.0.0.1')
  }

  const newGame = async (): Promise<string> => {
    const res = await fetch(`http://127.0.0.1:${port}/api/games`, {
      method: 'POST',
      body: JSON.stringify({ clock: { initialMs: 60_000, incrementMs: 0 } }),
    })
    return ((await res.json()) as { gameId: string }).gameId
  }

  const probe = (options: WebSocketTransportOptions = {}): Probe => {
    const sockets: WebSocket[] = []
    const transport = createWebSocketClient({
      url: (gameId) => `ws://127.0.0.1:${port}/ws/${gameId}`,
      createSocket: (url) => {
        const ws = new WebSocket(url)
        sockets.push(ws)
        return ws
      },
      reconnect: FAST,
      ...options,
    })
    const messages: ServerMessage[] = []
    const statuses: TransportStatus[] = []
    transport.subscribe((msg) => messages.push(msg))
    transport.onStatusChange((status) => statuses.push(status))
    const result: Probe = {
      transport,
      messages,
      statuses,
      sockets,
      waitFor: (predicate) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            stop()
            reject(new Error(`нет ожидаемого сообщения, пришло: ${JSON.stringify(messages)}`))
          }, 2000)
          const stop = transport.subscribe(() => {
            const found = messages.find(predicate)
            if (!found) return
            clearTimeout(timer)
            stop()
            resolve(found)
          })
          const found = messages.find(predicate)
          if (found) {
            clearTimeout(timer)
            stop()
            resolve(found)
          }
        }),
    }
    probes.push(result)
    return result
  }

  afterEach(async () => {
    for (const { transport } of probes.splice(0)) transport.disconnect()
    await server?.close()
    server = null
  })

  it('ведёт партию двух игроков', async () => {
    await start()
    const gameId = await newGame()
    const alice = probe()
    const bob = probe()
    await alice.transport.connect(gameId, identity('alice'), tokenOf('alice'))
    await bob.transport.connect(gameId, identity('bob'), tokenOf('bob'))

    alice.transport.send({ type: 'join', identity: identity('alice'), color: 'w' })
    bob.transport.send({ type: 'join', identity: identity('bob') })
    await bob.waitFor((m) => m.type === 'state' && m.status === 'playing')

    alice.transport.send({ type: 'move', from: 'e2', to: 'e4' })
    expect(await bob.waitFor((m) => m.type === 'moved')).toMatchObject({ san: 'e4' })
    expect(alice.statuses).toEqual(['connecting', 'open'])
  })

  it('держит сообщения в очереди до открытия сокета', async () => {
    await start()
    const gameId = await newGame()
    const alice = probe()
    const connecting = alice.transport.connect(gameId, identity('alice'), tokenOf('alice'))
    alice.transport.send({ type: 'join', identity: identity('alice'), color: 'b' })
    await connecting
    expect(await alice.waitFor((m) => m.type === 'state')).toMatchObject({ you: ['b'] })
  })

  it('подставляет секрет места в join', async () => {
    await start()
    const gameId = await newGame()
    const alice = probe()
    const eve = probe()
    await alice.transport.connect(gameId, identity('alice'), tokenOf('alice'))
    alice.transport.send({ type: 'join', identity: identity('alice') })
    await alice.waitFor((m) => m.type === 'state')

    await eve.transport.connect(gameId, identity('alice'), tokenOf('eve'))
    eve.transport.send({ type: 'join', identity: identity('alice') })
    expect(await eve.waitFor((m) => m.type === 'error')).toMatchObject({ code: 'unauthorized' })
  })

  it('переподключается после обрыва и заново получает состояние', async () => {
    await start()
    const gameId = await newGame()
    const alice = probe()
    const bob = probe()
    await alice.transport.connect(gameId, identity('alice'), tokenOf('alice'))
    await bob.transport.connect(gameId, identity('bob'), tokenOf('bob'))
    alice.transport.send({ type: 'join', identity: identity('alice'), color: 'w' })
    bob.transport.send({ type: 'join', identity: identity('bob') })
    await bob.waitFor((m) => m.type === 'state' && m.status === 'playing')
    alice.transport.send({ type: 'move', from: 'd2', to: 'd4' })
    await bob.waitFor((m) => m.type === 'moved')

    alice.messages.length = 0
    alice.sockets[0]?.close()
    await bob.waitFor((m) => m.type === 'opponentPresence' && m.color === 'w' && !m.online)

    // Клиент партии ничего не отправлял: join после переподключения уходит сам
    expect(await alice.waitFor((m) => m.type === 'state')).toMatchObject({
      status: 'playing',
      moves: ['d4'],
      you: ['w'],
    })
    expect(alice.statuses).toEqual(['connecting', 'open', 'reconnecting', 'open'])
  })

  it('сдаётся, если комнаты нет', async () => {
    await start()
    const lost = probe({ reconnect: { baseMs: 1, maxMs: 2, maxInitialAttempts: 3 } })
    await expect(lost.transport.connect('unknown', identity('alice'))).rejects.toThrow()
    expect(lost.statuses).toEqual(['connecting', 'closed'])
    expect(lost.sockets).toHaveLength(3)
  })

  it('не повторяет попытки, когда комната переполнена', async () => {
    await start({ maxClientsPerRoom: 1 })
    const gameId = await newGame()
    const first = probe()
    await first.transport.connect(gameId, identity('alice'), tokenOf('alice'))
    const second = probe()
    await second.transport.connect(gameId, identity('bob'), tokenOf('bob')).catch(() => {})
    await vi.waitFor(() => expect(second.statuses.at(-1)).toBe('closed'))
    expect(second.sockets).toHaveLength(1)
  })

  it('после disconnect закрывает сокет, молчит и не переподключается', async () => {
    await start()
    const gameId = await newGame()
    const alice = probe()
    const bob = probe()
    await alice.transport.connect(gameId, identity('alice'), tokenOf('alice'))
    await bob.transport.connect(gameId, identity('bob'), tokenOf('bob'))
    alice.transport.send({ type: 'join', identity: identity('alice'), color: 'w' })
    bob.transport.send({ type: 'join', identity: identity('bob') })
    await bob.waitFor((m) => m.type === 'state' && m.status === 'playing')

    alice.transport.disconnect()
    alice.transport.send({ type: 'move', from: 'e2', to: 'e4' })
    await bob.waitFor((m) => m.type === 'opponentPresence' && !m.online)
    await new Promise((resolve) => setTimeout(resolve, 60))

    expect(alice.statuses.at(-1)).toBe('closed')
    expect(alice.sockets).toHaveLength(1)
    expect(bob.messages.some((m) => m.type === 'moved')).toBe(false)
  })

  it('отклоняет connect, если disconnect вызван до открытия', async () => {
    await start()
    const gameId = await newGame()
    const alice = probe()
    const connecting = alice.transport.connect(gameId, identity('alice'))
    alice.transport.disconnect()
    await expect(connecting).rejects.toThrow()
  })
})
