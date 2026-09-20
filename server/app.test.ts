// @vitest-environment node
import { WebSocket } from 'ws'
import type { ClientMessage, ProtocolIdentity, ServerMessage } from '@/shared/api'
import { createChessServer, type ChessServer } from './app'
import type { RoomRegistryOptions } from './rooms/roomRegistry'

const identity = (id: string): ProtocolIdentity => ({
  kind: 'guest',
  id,
  displayName: id,
  avatar: { hue: 10, initials: id.slice(0, 2).toUpperCase() },
})

interface TestClient {
  messages: ServerMessage[]
  send(msg: ClientMessage): void
  waitFor(predicate: (msg: ServerMessage) => boolean): Promise<ServerMessage>
  close(): void
  closed: Promise<void>
}

/** Секрет места, которым тесты подписывают `join`. */
const tokenOf = (id: string) => `secret-of-${id}-0123456789`

const CLOCK = { initialMs: 60_000, incrementMs: 0 }

describe('сервер партий', () => {
  let server: ChessServer | null = null
  let port = 0
  const clients: TestClient[] = []

  const start = async (options: RoomRegistryOptions = {}) => {
    server = createChessServer(options)
    port = await server.listen(0, '127.0.0.1')
  }

  const createGame = async (body: unknown = { clock: CLOCK }) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/games`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return { status: res.status, json: (await res.json().catch(() => null)) as unknown }
  }

  const connect = (gameId: string, options: { autoPong?: boolean } = {}): Promise<TestClient> =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/${gameId}`, options)
      const messages: ServerMessage[] = []
      ws.on('message', (data) => messages.push(JSON.parse(data.toString()) as ServerMessage))
      const client: TestClient = {
        messages,
        send: (msg) => ws.send(JSON.stringify(msg)),
        waitFor: (predicate) =>
          new Promise((resolveMsg, rejectMsg) => {
            const check = () => {
              const found = messages.find(predicate)
              if (found) {
                clearTimeout(timer)
                ws.off('message', check)
                resolveMsg(found)
              }
              return found
            }
            const timer = setTimeout(() => {
              ws.off('message', check)
              rejectMsg(new Error(`нет ожидаемого сообщения, пришло: ${JSON.stringify(messages)}`))
            }, 2000)
            if (!check()) ws.on('message', check)
          }),
        close: () => ws.close(),
        closed: new Promise((resolveClosed) => ws.once('close', () => resolveClosed())),
      }
      clients.push(client)
      ws.once('open', () => resolve(client))
      ws.once('error', reject)
    })

  const newGame = async (): Promise<string> => {
    const { json } = await createGame()
    return (json as { gameId: string }).gameId
  }

  afterEach(async () => {
    for (const client of clients.splice(0)) client.close()
    await server?.close()
    server = null
  })

  describe('POST /api/games', () => {
    it('создаёт партию и отдаёт её id', async () => {
      await start()
      const { status, json } = await createGame()
      expect(status).toBe(201)
      expect((json as { gameId: string }).gameId).toMatch(/^[\w-]{8,}$/)
    })

    it('принимает партию без часов', async () => {
      await start()
      expect((await createGame({ clock: null })).status).toBe(201)
    })

    it.each([
      ['без поля clock', {}],
      ['часы вне пределов', { clock: { initialMs: 1, incrementMs: 0 } }],
      ['лишний тип', { clock: 'blitz' }],
    ])('отклоняет неверное тело: %s', async (_name, body) => {
      await start()
      expect((await createGame(body)).status).toBe(400)
    })

    it('отклоняет слишком большое тело', async () => {
      await start()
      const { status } = await createGame({ clock: null, junk: 'x'.repeat(2000) })
      expect(status).toBe(413)
    })

    it('отвечает 405 на другие методы и 404 на чужие пути', async () => {
      await start()
      const base = `http://127.0.0.1:${port}`
      expect((await fetch(`${base}/api/games`)).status).toBe(405)
      expect((await fetch(`${base}/nope`)).status).toBe(404)
      expect((await fetch(`${base}/api/health`)).status).toBe(200)
    })

    it('не создаёт больше комнат, чем разрешено', async () => {
      await start({ maxRooms: 1 })
      expect((await createGame()).status).toBe(201)
      expect((await createGame()).status).toBe(503)
    })
  })

  describe('WebSocket', () => {
    it('не подключает к несуществующей партии', async () => {
      await start()
      await expect(connect('unknown')).rejects.toThrow()
    })

    it('ведёт партию двух игроков', async () => {
      await start()
      const gameId = await newGame()
      const alice = await connect(gameId)
      const bob = await connect(gameId)

      alice.send({ type: 'join', identity: identity('alice'), color: 'w', token: tokenOf('alice') })
      const waiting = await alice.waitFor((m) => m.type === 'state')
      expect(waiting).toMatchObject({ status: 'waiting', you: ['w'] })

      bob.send({ type: 'join', identity: identity('bob'), token: tokenOf('bob') })
      expect(await bob.waitFor((m) => m.type === 'state')).toMatchObject({
        status: 'playing',
        you: ['b'],
      })

      alice.send({ type: 'move', from: 'e2', to: 'e4' })
      const moved = { type: 'moved', ply: 1, san: 'e4' }
      expect(await alice.waitFor((m) => m.type === 'moved')).toMatchObject(moved)
      expect(await bob.waitFor((m) => m.type === 'moved')).toMatchObject(moved)

      bob.send({ type: 'move', from: 'e7', to: 'e5' })
      expect(await alice.waitFor((m) => m.type === 'moved' && m.ply === 2)).toBeDefined()
    })

    it('говорит об ошибке, если ход не по правилам', async () => {
      await start()
      const gameId = await newGame()
      const alice = await connect(gameId)
      const bob = await connect(gameId)
      alice.send({ type: 'join', identity: identity('alice'), color: 'w', token: tokenOf('alice') })
      bob.send({ type: 'join', identity: identity('bob'), token: tokenOf('bob') })
      await bob.waitFor((m) => m.type === 'state' && m.status === 'playing')

      alice.send({ type: 'move', from: 'e2', to: 'e5' })
      expect(await alice.waitFor((m) => m.type === 'error')).toMatchObject({
        code: 'illegal-move',
      })
    })

    it('отвечает ошибкой на мусор вместо сообщения протокола', async () => {
      await start()
      const alice = await connect(await newGame())
      alice.send({ type: 'move', from: 'z9', to: 'e4' } as unknown as ClientMessage)
      expect(await alice.waitFor((m) => m.type === 'error')).toMatchObject({
        code: 'unsupported',
      })
    })

    it('сообщает сопернику об обрыве и возвращает состояние после повторного входа', async () => {
      await start()
      const gameId = await newGame()
      const alice = await connect(gameId)
      const bob = await connect(gameId)
      alice.send({ type: 'join', identity: identity('alice'), color: 'w', token: tokenOf('alice') })
      bob.send({ type: 'join', identity: identity('bob'), token: tokenOf('bob') })
      await bob.waitFor((m) => m.type === 'state' && m.status === 'playing')
      alice.send({ type: 'move', from: 'd2', to: 'd4' })
      await bob.waitFor((m) => m.type === 'moved')

      // Вкладка Алисы закрыта (перезагрузка страницы)
      alice.close()
      await alice.closed
      await bob.waitFor((m) => m.type === 'opponentPresence' && m.color === 'w' && !m.online)

      // Новая вкладка входит с той же личностью и получает партию с прежним местом
      const reloaded = await connect(gameId)
      reloaded.send({ type: 'join', identity: identity('alice'), token: tokenOf('alice') })
      expect(await reloaded.waitFor((m) => m.type === 'state')).toMatchObject({
        status: 'playing',
        moves: ['d4'],
        you: ['w'],
      })
      await bob.waitFor((m) => m.type === 'opponentPresence' && m.color === 'w' && m.online)
    })

    describe('секрет места', () => {
      it('не пускает без токена', async () => {
        await start()
        const eve = await connect(await newGame())
        eve.send({ type: 'join', identity: identity('eve') })
        expect(await eve.waitFor((m) => m.type === 'error')).toMatchObject({
          code: 'unauthorized',
        })
        expect(eve.messages.some((m) => m.type === 'state')).toBe(false)
      })

      it('не отдаёт занятое место тому, кто знает только id', async () => {
        await start()
        const gameId = await newGame()
        const alice = await connect(gameId)
        const bob = await connect(gameId)
        alice.send({
          type: 'join',
          identity: identity('alice'),
          color: 'w',
          token: tokenOf('alice'),
        })
        bob.send({ type: 'join', identity: identity('bob'), token: tokenOf('bob') })
        await bob.waitFor((m) => m.type === 'state' && m.status === 'playing')

        const eve = await connect(gameId)
        eve.send({ type: 'join', identity: identity('alice'), token: tokenOf('eve') })
        expect(await eve.waitFor((m) => m.type === 'error')).toMatchObject({
          code: 'unauthorized',
        })
        // Отклонённый join не дал ей места: ход от её имени не проходит
        eve.send({ type: 'move', from: 'e2', to: 'e4' })
        await eve.waitFor((m) => m.type === 'error' && m.code === 'not-joined')
      })

      it('пускает обратно с тем же токеном и не показывает его хосту', async () => {
        await start()
        const gameId = await newGame()
        const first = await connect(gameId)
        first.send({
          type: 'join',
          identity: identity('alice'),
          color: 'w',
          token: tokenOf('alice'),
        })
        await first.waitFor((m) => m.type === 'state')
        first.close()
        await first.closed

        const again = await connect(gameId)
        again.send({ type: 'join', identity: identity('alice'), token: tokenOf('alice') })
        const state = await again.waitFor((m) => m.type === 'state')
        expect(state).toMatchObject({ you: ['w'] })
        expect(JSON.stringify(again.messages)).not.toContain(tokenOf('alice'))
      })

      it('секреты разных комнат не связаны', async () => {
        await start()
        const [gameA, gameB] = [await newGame(), await newGame()]
        const a = await connect(gameA)
        a.send({ type: 'join', identity: identity('alice'), token: tokenOf('alice') })
        await a.waitFor((m) => m.type === 'state')

        const b = await connect(gameB)
        b.send({ type: 'join', identity: identity('alice'), token: tokenOf('other') })
        expect(await b.waitFor((m) => m.type === 'state')).toBeDefined()
      })
    })

    it('ограничивает число соединений в комнате', async () => {
      await start({ maxClientsPerRoom: 1 })
      const gameId = await newGame()
      await connect(gameId)
      const extra = await connect(gameId)
      await extra.closed
    })
  })

  describe('время жизни комнат', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    it('удаляет комнату, в которую так никто и не зашёл', async () => {
      await start({ emptyTtlMs: 30 })
      const gameId = await newGame()
      await sleep(120)
      await expect(connect(gameId)).rejects.toThrow()
    })

    it('не трогает комнату с клиентом и удаляет её, когда все ушли', async () => {
      await start({ emptyTtlMs: 100 })
      const gameId = await newGame()
      const alice = await connect(gameId)
      await sleep(200)

      // Пока клиент подключён, комната живёт дольше TTL
      alice.send({ type: 'join', identity: identity('alice'), color: 'w', token: tokenOf('alice') })
      await alice.waitFor((m) => m.type === 'state')

      alice.close()
      await alice.closed
      await sleep(200)
      await expect(connect(gameId)).rejects.toThrow()
    })
  })

  describe('heartbeat', () => {
    it('отключает клиента, который не отвечает на ping, и сообщает об этом сопернику', async () => {
      await start({ heartbeatMs: 30 })
      const gameId = await newGame()
      const alice = await connect(gameId, { autoPong: false })
      const bob = await connect(gameId)
      alice.send({ type: 'join', identity: identity('alice'), color: 'w', token: tokenOf('alice') })
      bob.send({ type: 'join', identity: identity('bob'), token: tokenOf('bob') })
      await bob.waitFor((m) => m.type === 'state' && m.status === 'playing')

      await alice.closed
      await bob.waitFor((m) => m.type === 'opponentPresence' && m.color === 'w' && !m.online)
    })
  })
})
