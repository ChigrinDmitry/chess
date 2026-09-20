import { createLocalRoom } from './LocalTransport'
import type { ClientMessage, ProtocolIdentity, ServerMessage } from './protocol'
import type { TransportStatus } from './transport'

const identity: ProtocolIdentity = {
  kind: 'guest',
  id: 'g1',
  displayName: 'Ладья',
  avatar: { hue: 10, initials: 'Л' },
}
const move: ClientMessage = { type: 'move', from: 'e2', to: 'e4' }
const over: ServerMessage = { type: 'drawDeclined' }

describe('LocalTransport', () => {
  it('доставляет сообщения клиента хосту с идентификатором соединения, синхронно', () => {
    const room = createLocalRoom()
    const onMessage = vi.fn()
    room.host.onMessage(onMessage)
    const client = room.createClient()
    void client.connect('room', identity)

    client.send(move)
    expect(onMessage).toHaveBeenCalledExactlyOnceWith(expect.any(String), move)
  })

  it('у каждого клиента свой clientId', () => {
    const room = createLocalRoom()
    const ids: string[] = []
    room.host.onMessage((id) => ids.push(id))
    const a = room.createClient()
    const b = room.createClient()
    void a.connect('room', identity)
    void b.connect('room', identity)
    a.send(move)
    b.send(move)
    expect(new Set(ids).size).toBe(2)
  })

  it('send адресует одному клиенту, broadcast — всем', () => {
    const room = createLocalRoom()
    let target = ''
    room.host.onMessage((id) => (target = id))
    const a = room.createClient()
    const b = room.createClient()
    const gotA = vi.fn()
    const gotB = vi.fn()
    a.subscribe(gotA)
    b.subscribe(gotB)
    void a.connect('room', identity)
    void b.connect('room', identity)

    a.send(move)
    room.host.send(target, over)
    expect(gotA).toHaveBeenCalledExactlyOnceWith(over)
    expect(gotB).not.toHaveBeenCalled()

    room.host.broadcast(over)
    expect(gotA).toHaveBeenCalledTimes(2)
    expect(gotB).toHaveBeenCalledOnce()
  })

  it('сообщения до connect и после disconnect отбрасываются', () => {
    const room = createLocalRoom()
    const onMessage = vi.fn()
    room.host.onMessage(onMessage)
    const client = room.createClient()

    client.send(move)
    void client.connect('room', identity)
    client.disconnect()
    client.send(move)
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('после disconnect клиент ничего не получает, хост узнаёт об отключении', () => {
    const room = createLocalRoom()
    const left = vi.fn()
    room.host.onClientDisconnect(left)
    const client = room.createClient()
    const got = vi.fn()
    client.subscribe(got)
    void client.connect('room', identity)
    client.disconnect()
    client.disconnect()

    room.host.broadcast(over)
    expect(got).not.toHaveBeenCalled()
    expect(left).toHaveBeenCalledOnce()
  })

  it('сообщает о статусе и позволяет подключиться заново', async () => {
    const room = createLocalRoom()
    const client = room.createClient()
    const statuses: TransportStatus[] = []
    client.onStatusChange((s) => statuses.push(s))

    await client.connect('room', identity)
    await client.connect('room', identity)
    client.disconnect()
    await client.connect('room', identity)
    expect(statuses).toEqual(['open', 'closed', 'open'])

    const got = vi.fn()
    client.subscribe(got)
    room.host.broadcast(over)
    expect(got).toHaveBeenCalledOnce()
  })

  it('отписка снимает обработчик', () => {
    const room = createLocalRoom()
    const onMessage = vi.fn()
    const off = room.host.onMessage(onMessage)
    const client = room.createClient()
    void client.connect('room', identity)
    off()
    client.send(move)
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('close хоста закрывает всех клиентов', () => {
    const room = createLocalRoom()
    const client = room.createClient()
    const statuses: TransportStatus[] = []
    client.onStatusChange((s) => statuses.push(s))
    void client.connect('room', identity)
    room.host.close()
    expect(statuses).toEqual(['open', 'closed'])
  })
})
