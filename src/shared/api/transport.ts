import type { ClientMessage, ProtocolIdentity, ServerMessage } from './protocol'

export type TransportStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

/** Токен сессии для handshake; в MVP (только гость) его нет. */
export type SessionToken = string

export type Unsubscribe = () => void

/**
 * Клиентская сторона канала связи с комнатой. UI и клиент партии не знают, как сообщения
 * доходят до соперника: в hot-seat, между вкладками или через WebSocket.
 *
 * `send` до открытия соединения ставит сообщение в очередь и отправляет его после `connect`;
 * после `disconnect` сообщения отбрасываются.
 */
export interface GameTransport {
  connect(gameId: string, identity: ProtocolIdentity, auth?: SessionToken): Promise<void>
  disconnect(): void
  send(msg: ClientMessage): void
  subscribe(handler: (msg: ServerMessage) => void): Unsubscribe
  onStatusChange(handler: (status: TransportStatus) => void): Unsubscribe
}

/**
 * Серверная сторона канала: её слушает хост партии (`features/host-game`). Когда появится
 * бэкенд, эту роль займёт сервер, а на клиенте останется только `GameTransport`.
 *
 * `clientId` выдаёт транспорт, он уникален для каждого соединения (одна и та же личность
 * в двух вкладках — два клиента).
 */
export interface HostTransport {
  onMessage(handler: (clientId: string, msg: ClientMessage) => void): Unsubscribe
  onClientDisconnect(handler: (clientId: string) => void): Unsubscribe
  send(clientId: string, msg: ServerMessage): void
  /** Всем подключённым клиентам. */
  broadcast(msg: ServerMessage): void
  close(): void
}
