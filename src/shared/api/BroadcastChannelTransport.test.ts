import { createBroadcastClient, createBroadcastHost } from './BroadcastChannelTransport'
import type { ClientMessage, ProtocolIdentity, ServerMessage } from './protocol'
import type { GameTransport, HostTransport, TransportStatus } from './transport'

const identity: ProtocolIdentity = {
  kind: 'guest',
  id: 'g1',
  displayName: 'Ладья',
  avatar: { hue: 10, initials: 'Л' },
}
const move: ClientMessage = { type: 'move', from: 'e2', to: 'e4' }
const declined: ServerMessage = { type: 'drawDeclined' }

/** BroadcastChannel доставляет сообщения асинхронно (макрозадачей). */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

let seq = 0
let host: HostTransport
let clients: GameTransport[]
let room: string

const newClient = async () => {
  const client = createBroadcastClient()
  clients.push(client)
  await client.connect(room, identity)
  return client
}

beforeEach(() => {
  room = `test-${++seq}`
  clients = []
  host = createBroadcastHost(room)
})

afterEach(() => {
  for (const client of clients) client.disconnect()
  host.close()
})

describe('BroadcastChannelTransport', () => {
  it('доставляет сообщение клиента хосту', async () => {
    const onMessage = vi.fn()
    host.onMessage(onMessage)
    const client = await newClient()

    client.send(move)
    await flush()
    expect(onMessage).toHaveBeenCalledExactlyOnceWith(expect.any(String), move)
  })

  it('send адресует одного клиента, broadcast — всех', async () => {
    let from = ''
    host.onMessage((id) => (from = id))
    const a = await newClient()
    const b = await newClient()
    const gotA = vi.fn()
    const gotB = vi.fn()
    a.subscribe(gotA)
    b.subscribe(gotB)

    a.send(move)
    await flush()
    host.send(from, declined)
    await flush()
    expect(gotA).toHaveBeenCalledExactlyOnceWith(declined)
    expect(gotB).not.toHaveBeenCalled()

    host.broadcast(declined)
    await flush()
    expect(gotA).toHaveBeenCalledTimes(2)
    expect(gotB).toHaveBeenCalledOnce()
  })

  it('клиенты не видят сообщений друг друга', async () => {
    const a = await newClient()
    const b = await newClient()
    const gotB = vi.fn()
    b.subscribe(gotB)
    a.send(move)
    await flush()
    expect(gotB).not.toHaveBeenCalled()
  })

  it('комнаты изолированы друг от друга', async () => {
    const other = createBroadcastHost(`${room}-other`)
    const onOther = vi.fn()
    other.onMessage(onOther)
    const client = await newClient()
    client.send(move)
    await flush()
    other.close()
    expect(onOther).not.toHaveBeenCalled()
  })

  it('отбрасывает мусор, не соответствующий протоколу', async () => {
    const onMessage = vi.fn()
    host.onMessage(onMessage)
    const got = vi.fn()
    const client = await newClient()
    client.subscribe(got)

    const raw = new BroadcastChannel(`chess:game:${room}`)
    raw.postMessage({ dir: 'up', from: 'evil', msg: { type: 'move', from: 'zz', to: 'e4' } })
    raw.postMessage({ dir: 'up', from: 'evil', msg: 'move' })
    raw.postMessage({ dir: 'down', to: null, msg: { type: 'state' } })
    raw.postMessage('вообще не конверт')
    await flush()
    raw.close()

    expect(onMessage).not.toHaveBeenCalled()
    expect(got).not.toHaveBeenCalled()
  })

  it('disconnect сообщает хосту об отключении один раз', async () => {
    const left = vi.fn()
    host.onClientDisconnect(left)
    let id = ''
    host.onMessage((clientId) => (id = clientId))
    const client = await newClient()
    client.send(move)
    await flush()

    client.disconnect()
    client.disconnect()
    await flush()
    expect(left).toHaveBeenCalledExactlyOnceWith(id)
  })

  it('pagehide отключает клиента', async () => {
    const left = vi.fn()
    host.onClientDisconnect(left)
    const client = await newClient()
    const statuses: TransportStatus[] = []
    client.onStatusChange((s) => statuses.push(s))
    client.send(move)
    await flush()

    globalThis.dispatchEvent(new Event('pagehide'))
    await flush()
    expect(statuses).toEqual(['closed'])
    expect(left).toHaveBeenCalledOnce()
  })

  it('сообщает о статусе и не шлёт после disconnect', async () => {
    const onMessage = vi.fn()
    host.onMessage(onMessage)
    const client = createBroadcastClient()
    clients.push(client)
    const statuses: TransportStatus[] = []
    client.onStatusChange((s) => statuses.push(s))

    await client.connect(room, identity)
    await client.connect(room, identity)
    client.disconnect()
    client.send(move)
    await flush()
    expect(statuses).toEqual(['connecting', 'open', 'closed'])
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('отписка снимает обработчики хоста', async () => {
    const onMessage = vi.fn()
    host.onMessage(onMessage)()
    const client = await newClient()
    client.send(move)
    await flush()
    expect(onMessage).not.toHaveBeenCalled()
  })
})
