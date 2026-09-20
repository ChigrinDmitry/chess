import type { ClockConfig } from '@/entities/clock'
import type { Color } from '@/entities/game'
import type { PlayerIdentity } from '@/entities/player'
import {
  createLocalRoom,
  type ClientMessage,
  type ServerMessage,
  type StateMessage,
} from '@/shared/api'
import { createGameHost, type GameHost } from './createGameHost'

const identity = (id: string, name = id): PlayerIdentity => ({
  kind: 'guest',
  id,
  displayName: name,
  avatar: { hue: 100, initials: name.slice(0, 1).toUpperCase() },
})

const ANNA = identity('anna', 'Анна')
const BORIS = identity('boris', 'Борис')
const CLARA = identity('clara', 'Клара')

const ONE_MINUTE: ClockConfig = { initialMs: 60_000, incrementMs: 1000 }

type Of<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>

/** Тестовый клиент: подключается к комнате и записывает всё, что присылает хост. */
function connect(room: ReturnType<typeof createLocalRoom>) {
  const transport = room.createClient()
  const received: ServerMessage[] = []
  transport.subscribe((msg) => received.push(msg))
  void transport.connect('room', ANNA)
  return {
    received,
    send: (msg: ClientMessage) => transport.send(msg),
    disconnect: () => transport.disconnect(),
    join(who: PlayerIdentity, color?: Color) {
      this.send({ type: 'join', identity: who, ...(color ? { color } : {}) })
      return this
    },
    move(from: string, to: string, promotion?: 'n' | 'b' | 'r' | 'q') {
      this.send({ type: 'move', from, to, ...(promotion ? { promotion } : {}) } as ClientMessage)
    },
    of<T extends ServerMessage['type']>(type: T): Of<T>[] {
      return received.filter((m): m is Of<T> => m.type === type)
    },
    last<T extends ServerMessage['type']>(type: T): Of<T> {
      const all = this.of(type)
      const found = all[all.length - 1]
      if (!found) throw new Error(`Нет сообщения ${type}`)
      return found
    },
    types: () => received.map((m) => m.type),
    clear: () => (received.length = 0),
  }
}
type TestClient = ReturnType<typeof connect>

let host: GameHost
let room: ReturnType<typeof createLocalRoom>

function setup(options: { clock?: ClockConfig | null } = {}) {
  room = createLocalRoom()
  host = createGameHost({ transport: room.host, clock: options.clock ?? null })
  host.start()
  return room
}

/** Двое за столом: Анна — белые, Борис — чёрные. */
function twoPlayers(options: { clock?: ClockConfig | null } = {}): [TestClient, TestClient] {
  setup(options)
  const anna = connect(room).join(ANNA)
  const boris = connect(room).join(BORIS)
  anna.clear()
  boris.clear()
  return [anna, boris]
}

/** Детский мат: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# */
function playFoolsMate(white: TestClient, black: TestClient) {
  white.move('e2', 'e4')
  black.move('e7', 'e5')
  white.move('f1', 'c4')
  black.move('b8', 'c6')
  white.move('d1', 'h5')
  black.move('g8', 'f6')
  white.move('h5', 'f7')
}

afterEach(() => {
  host.stop()
  vi.useRealTimers()
})

describe('вход в комнату', () => {
  it('первый игрок садится за белых, второй — за чёрных; партия начинается с двумя', () => {
    setup()
    const anna = connect(room).join(ANNA)
    expect(anna.last('state')).toMatchObject({
      status: 'waiting',
      you: ['w'],
      players: { w: ANNA, b: null },
      moves: [],
      result: null,
      clock: null,
    })

    const boris = connect(room).join(BORIS)
    expect(boris.last('state')).toMatchObject({ status: 'playing', you: ['b'] })
    // Анна тоже узнаёт, что соперник сел
    expect(anna.last('state')).toMatchObject({
      status: 'playing',
      you: ['w'],
      players: { w: ANNA, b: BORIS },
    })
  })

  it('учитывает предпочтительный цвет, а занятый уступает свободному', () => {
    setup()
    const anna = connect(room).join(ANNA, 'b')
    expect(anna.last('state').you).toEqual(['b'])
    const boris = connect(room).join(BORIS, 'b')
    expect(boris.last('state').you).toEqual(['w'])
  })

  it('третьему игроку места нет', () => {
    setup()
    connect(room).join(ANNA)
    connect(room).join(BORIS)
    const clara = connect(room).join(CLARA)
    expect(clara.of('error')).toEqual([{ type: 'error', code: 'room-full' }])
    expect(clara.of('state')).toHaveLength(0)
  })

  it('повторный join той же личности — resync на том же месте', () => {
    const [anna, boris] = twoPlayers()
    anna.move('e2', 'e4')
    anna.clear()

    anna.join(ANNA)
    expect(anna.last('state')).toMatchObject({ you: ['w'], moves: ['e4'], status: 'playing' })
    expect(boris.last('state')).toMatchObject({ you: ['b'], moves: ['e4'] })
  })

  it('сообщает о присутствии игроков и об отключении', () => {
    setup()
    const anna = connect(room).join(ANNA)
    expect(anna.last('opponentPresence')).toEqual({
      type: 'opponentPresence',
      color: 'w',
      online: true,
    })
    const boris = connect(room).join(BORIS)
    expect(boris.of('opponentPresence')).toEqual(
      expect.arrayContaining([
        { type: 'opponentPresence', color: 'w', online: true },
        { type: 'opponentPresence', color: 'b', online: true },
      ]),
    )

    anna.clear()
    boris.disconnect()
    expect(anna.last('opponentPresence')).toEqual({
      type: 'opponentPresence',
      color: 'b',
      online: false,
    })
  })

  it('возвращение после отключения — то же место, партия продолжается', () => {
    const [anna, boris] = twoPlayers()
    anna.move('e2', 'e4')
    boris.disconnect()

    const again = connect(room).join(BORIS)
    expect(again.last('state')).toMatchObject({ you: ['b'], moves: ['e4'], status: 'playing' })
    again.move('e7', 'e5')
    expect(anna.last('moved').san).toBe('e5')
  })

  it('до join сообщения отклоняются', () => {
    setup()
    const stranger = connect(room)
    stranger.move('e2', 'e4')
    stranger.send({ type: 'resign' })
    expect(stranger.of('error')).toEqual([
      { type: 'error', code: 'not-joined' },
      { type: 'error', code: 'not-joined' },
    ])
  })

  it('ping игнорируется', () => {
    const [anna] = twoPlayers()
    anna.send({ type: 'ping' })
    expect(anna.received).toEqual([])
  })

  it('отмена хода против человека не поддерживается', () => {
    const [anna] = twoPlayers()
    anna.send({ type: 'takeback' })
    expect(anna.last('error').code).toBe('unsupported')
  })
})

describe('ходы', () => {
  it('легальный ход рассылается обоим с номером полухода и позицией', () => {
    const [anna, boris] = twoPlayers()
    anna.move('e2', 'e4')

    const expected = {
      type: 'moved',
      ply: 1,
      san: 'e4',
      move: { from: 'e2', to: 'e4' },
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      clock: null,
    }
    expect(anna.last('moved')).toEqual(expected)
    expect(boris.last('moved')).toEqual(expected)

    boris.move('e7', 'e5')
    expect(anna.last('moved')).toMatchObject({ ply: 2, san: 'e5' })
  })

  it('чужой ход и ход не в свою очередь отклоняются', () => {
    const [anna, boris] = twoPlayers()
    boris.move('e7', 'e5')
    expect(boris.last('error').code).toBe('not-your-turn')

    anna.move('e2', 'e4')
    anna.move('d2', 'd4')
    expect(anna.last('error').code).toBe('not-your-turn')
    expect(boris.of('moved')).toHaveLength(1)
  })

  it('нелегальный ход отклоняется и ничего не меняет', () => {
    const [anna, boris] = twoPlayers()
    anna.move('e2', 'e5')
    expect(anna.last('error').code).toBe('illegal-move')
    expect(boris.of('moved')).toHaveLength(0)

    anna.move('e2', 'e4')
    expect(boris.last('moved').san).toBe('e4')
  })

  it('пока нет соперника, ходить нельзя', () => {
    setup()
    const anna = connect(room).join(ANNA)
    anna.move('e2', 'e4')
    expect(anna.last('error').code).toBe('not-started')
  })

  it('превращение пешки передаёт выбранную фигуру', () => {
    const [anna, boris] = twoPlayers()
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
    line.forEach(([from, to], i) => (i % 2 === 0 ? anna : boris).move(from, to))
    anna.move('g7', 'h8', 'n')
    expect(boris.last('moved')).toMatchObject({
      san: 'gxh8=N',
      move: { from: 'g7', to: 'h8', promotion: 'n' },
    })
  })

  it('мат: сначала `moved`, затем `gameOver`; после этого ходить нельзя', () => {
    const [anna, boris] = twoPlayers()
    playFoolsMate(anna, boris)

    expect(anna.types().slice(-2)).toEqual(['moved', 'gameOver'])
    expect(boris.last('gameOver')).toEqual({
      type: 'gameOver',
      result: '1-0',
      reason: 'checkmate',
      clock: null,
    })

    boris.move('a7', 'a6')
    expect(boris.last('error').code).toBe('game-over')
  })

  it('пат — ничья', () => {
    const [anna, boris] = twoPlayers()
    // Самый короткий пат (Сэм Лойд): 1. e3 a5 2. Qh5 Ra6 3. Qxa5 h5 4. Qxc7 Rah6 5. h4 f6
    // 6. Qxd7+ Kf7 7. Qxb7 Qd3 8. Qxb8 Qh7 9. Qxc8 Kg6 10. Qe6
    const line = [
      ['e2', 'e3'],
      ['a7', 'a5'],
      ['d1', 'h5'],
      ['a8', 'a6'],
      ['h5', 'a5'],
      ['h7', 'h5'],
      ['a5', 'c7'],
      ['a6', 'h6'],
      ['h2', 'h4'],
      ['f7', 'f6'],
      ['c7', 'd7'],
      ['e8', 'f7'],
      ['d7', 'b7'],
      ['d8', 'd3'],
      ['b7', 'b8'],
      ['d3', 'h7'],
      ['b8', 'c8'],
      ['f7', 'g6'],
      ['c8', 'e6'],
    ] as const
    line.forEach(([from, to], i) => (i % 2 === 0 ? anna : boris).move(from, to))

    expect(boris.last('gameOver')).toMatchObject({ result: '1/2-1/2', reason: 'stalemate' })
  })
})

describe('сдача', () => {
  it('сдавшийся проигрывает, оба получают итог', () => {
    const [anna, boris] = twoPlayers()
    anna.move('e2', 'e4')
    boris.send({ type: 'resign' })

    expect(anna.last('gameOver')).toMatchObject({ result: '1-0', reason: 'resignation' })
    expect(boris.last('gameOver')).toMatchObject({ result: '1-0', reason: 'resignation' })
  })

  it('сдаться можно и не в свой ход', () => {
    const [anna, boris] = twoPlayers()
    anna.send({ type: 'resign' })
    expect(boris.last('gameOver')).toMatchObject({ result: '0-1', reason: 'resignation' })
  })

  it('после конца партии и до её начала сдача отклоняется', () => {
    setup()
    const anna = connect(room).join(ANNA)
    anna.send({ type: 'resign' })
    expect(anna.last('error').code).toBe('not-started')

    const boris = connect(room).join(BORIS)
    boris.send({ type: 'resign' })
    boris.send({ type: 'resign' })
    expect(boris.last('error').code).toBe('game-over')
    expect(boris.of('gameOver')).toHaveLength(1)
  })
})

describe('ничья по соглашению', () => {
  it('предложение видят оба; согласие заканчивает партию вничью', () => {
    const [anna, boris] = twoPlayers()
    anna.send({ type: 'offerDraw' })
    expect(boris.last('drawOffered')).toEqual({ type: 'drawOffered', by: 'w' })
    expect(anna.last('drawOffered')).toEqual({ type: 'drawOffered', by: 'w' })

    boris.send({ type: 'answerDraw', accept: true })
    expect(anna.last('gameOver')).toMatchObject({ result: '1/2-1/2', reason: 'agreement' })
  })

  it('отказ снимает предложение, партия идёт дальше', () => {
    const [anna, boris] = twoPlayers()
    anna.send({ type: 'offerDraw' })
    boris.send({ type: 'answerDraw', accept: false })
    expect(anna.last('drawDeclined')).toEqual({ type: 'drawDeclined' })

    anna.move('e2', 'e4')
    expect(boris.last('moved').san).toBe('e4')
    boris.send({ type: 'answerDraw', accept: true })
    expect(boris.last('error').code).toBe('no-draw-offer')
  })

  it('предложивший не может ответить на своё предложение', () => {
    const [anna] = twoPlayers()
    anna.send({ type: 'offerDraw' })
    anna.send({ type: 'answerDraw', accept: true })
    expect(anna.last('error').code).toBe('not-your-turn')
    expect(anna.of('gameOver')).toHaveLength(0)
  })

  it('повторное предложение того же игрока ничего не меняет', () => {
    const [anna, boris] = twoPlayers()
    anna.send({ type: 'offerDraw' })
    anna.send({ type: 'offerDraw' })
    expect(boris.of('drawOffered')).toHaveLength(1)
  })

  it('встречные предложения — это согласие', () => {
    const [anna, boris] = twoPlayers()
    anna.send({ type: 'offerDraw' })
    boris.send({ type: 'offerDraw' })
    expect(anna.last('gameOver')).toMatchObject({ result: '1/2-1/2', reason: 'agreement' })
  })

  it('ход соперника — отказ: предложение пропадает из состояния', () => {
    const [anna, boris] = twoPlayers()
    anna.send({ type: 'offerDraw' })
    anna.move('e2', 'e4')

    boris.join(BORIS)
    expect(boris.last('state').drawOffer).toBeNull()
  })

  it('offerDraw и answerDraw вне идущей партии отклоняются', () => {
    setup()
    const anna = connect(room).join(ANNA)
    anna.send({ type: 'offerDraw' })
    anna.send({ type: 'answerDraw', accept: true })
    expect(anna.of('error').map((e) => e.code)).toEqual(['not-started', 'not-started'])
  })

  it('resync показывает действующее предложение', () => {
    const [anna, boris] = twoPlayers()
    anna.send({ type: 'offerDraw' })
    boris.join(BORIS)
    expect(boris.last('state').drawOffer).toBe('w')
  })
})

describe('часы', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  it('состояние содержит настройки и остатки; часы стоят до первого хода белых', () => {
    const [anna] = twoPlayers({ clock: ONE_MINUTE })
    anna.join(ANNA)
    expect(anna.last('state').clock).toEqual({
      config: ONE_MINUTE,
      remaining: { w: 60_000, b: 60_000 },
      running: null,
    })
    vi.advanceTimersByTime(30_000)
    anna.join(ANNA)
    expect(anna.last('state').clock?.remaining.w).toBe(60_000)
  })

  it('после хода белых идут часы чёрных; ход чёрных даёт им инкремент', () => {
    const [anna, boris] = twoPlayers({ clock: ONE_MINUTE })
    anna.move('e2', 'e4')
    expect(boris.last('moved').clock).toEqual({
      remaining: { w: 60_000, b: 60_000 },
      running: 'b',
    })

    vi.advanceTimersByTime(5000)
    boris.move('e7', 'e5')
    expect(anna.last('moved').clock).toEqual({
      remaining: { w: 60_000, b: 56_000 },
      running: 'w',
    })

    vi.advanceTimersByTime(3000)
    anna.move('g1', 'f3')
    expect(boris.last('moved').clock).toEqual({
      remaining: { w: 58_000, b: 56_000 },
      running: 'b',
    })
  })

  it('упавший флаг — поражение по времени', () => {
    const [anna, boris] = twoPlayers({ clock: ONE_MINUTE })
    anna.move('e2', 'e4')
    boris.move('e7', 'e5')
    vi.advanceTimersByTime(60_000 + 1000)

    expect(anna.last('gameOver')).toEqual({
      type: 'gameOver',
      result: '0-1',
      reason: 'timeout',
      clock: { remaining: { w: 0, b: 61_000 }, running: null },
    })
  })

  it('ход, сделанный после истечения времени, не спасает: флаг падает', () => {
    const [anna, boris] = twoPlayers({ clock: ONE_MINUTE })
    anna.move('e2', 'e4')
    // Время прыгнуло вперёд, а таймер флага не успел сработать
    vi.setSystemTime(70_000)
    boris.move('e7', 'e5')

    expect(anna.types().slice(-2)).toEqual(['moved', 'gameOver'])
    expect(anna.last('gameOver')).toMatchObject({ result: '1-0', reason: 'timeout' })

    vi.advanceTimersByTime(120_000)
    expect(anna.of('gameOver')).toHaveLength(1)
  })

  it('с концом партии часы останавливаются', () => {
    const [anna, boris] = twoPlayers({ clock: ONE_MINUTE })
    anna.move('e2', 'e4')
    vi.advanceTimersByTime(10_000)
    anna.send({ type: 'resign' })
    expect(boris.last('gameOver').clock).toEqual({
      remaining: { w: 60_000, b: 50_000 },
      running: null,
    })

    vi.advanceTimersByTime(600_000)
    boris.join(BORIS)
    expect(boris.last('state').clock?.remaining).toEqual({ w: 60_000, b: 50_000 })
  })

  it('мат останавливает часы без инкремента', () => {
    const [anna, boris] = twoPlayers({ clock: ONE_MINUTE })
    playFoolsMate(anna, boris)
    expect(anna.last('moved').clock).toMatchObject({ running: null })
    // Инкремент получили три хода чёрных и два хода белых до мата; мат-ход — без инкремента
    expect(anna.last('gameOver').clock?.remaining).toEqual({ w: 62_000, b: 63_000 })
  })
})

describe('реванш', () => {
  it('пока партия идёт, реванш не предлагается', () => {
    const [anna] = twoPlayers()
    anna.send({ type: 'rematch' })
    expect(anna.last('error').code).toBe('game-not-over')
  })

  it('один голос — только запрос; оба — новая партия с обменом цветов', () => {
    const [anna, boris] = twoPlayers({ clock: ONE_MINUTE })
    anna.move('e2', 'e4')
    anna.send({ type: 'resign' })
    anna.clear()
    boris.clear()

    anna.send({ type: 'rematch' })
    expect(boris.last('rematchRequested')).toEqual({ type: 'rematchRequested', by: 'w' })
    expect(boris.of('state')).toHaveLength(0)

    boris.send({ type: 'rematch' })
    expect(anna.last('state')).toMatchObject({
      status: 'playing',
      you: ['b'],
      players: { w: BORIS, b: ANNA },
      moves: [],
      result: null,
      clock: { remaining: { w: 60_000, b: 60_000 }, running: null },
    })
    expect(boris.last('state').you).toEqual(['w'])

    // Теперь белые — у Бориса
    boris.move('e2', 'e4')
    expect(anna.last('moved').san).toBe('e4')
  })

  it('повторный голос того же игрока не считается за оба', () => {
    const [anna, boris] = twoPlayers()
    anna.send({ type: 'resign' })
    anna.send({ type: 'rematch' })
    anna.send({ type: 'rematch' })
    expect(boris.of('state')).toHaveLength(0)
  })

  it('после реванша итог объявляется снова', () => {
    const [anna, boris] = twoPlayers()
    anna.send({ type: 'resign' })
    anna.send({ type: 'rematch' })
    boris.send({ type: 'rematch' })
    boris.send({ type: 'resign' })
    expect(anna.of('gameOver')).toHaveLength(2)
  })
})

describe('hot-seat', () => {
  const WHITE = identity('local-white', 'Белые')
  const BLACK = identity('local-black', 'Чёрные')

  function hotSeat(clock: ClockConfig | null = null) {
    room = createLocalRoom()
    host = createGameHost({ transport: room.host, clock, hotSeat: { w: WHITE, b: BLACK } })
    host.start()
    const player = connect(room).join(ANNA)
    return player
  }

  it('снимок без клиента — как его увидит единственный клиент', () => {
    hotSeat()
    expect(host.snapshot()).toMatchObject({
      status: 'playing',
      you: ['w', 'b'],
      players: { w: WHITE, b: BLACK },
    })
  })

  it('один клиент играет за обе стороны', () => {
    const player = hotSeat()
    expect(player.last('state')).toMatchObject({ status: 'playing', you: ['w', 'b'] })
    player.move('e2', 'e4')
    player.move('e7', 'e5')
    expect(player.of('moved').map((m) => m.san)).toEqual(['e4', 'e5'])
    player.move('a7', 'a6')
    expect(player.last('error').code).toBe('illegal-move')
  })

  it('сдаётся и предлагает ничью сторона, чей ход; отвечает другая', () => {
    const player = hotSeat()
    player.move('e2', 'e4')
    player.send({ type: 'offerDraw' })
    expect(player.last('drawOffered').by).toBe('b')
    player.send({ type: 'answerDraw', accept: false })
    player.send({ type: 'resign' })
    expect(player.last('gameOver')).toMatchObject({ result: '1-0', reason: 'resignation' })
  })

  it('согласие на ничью завершает партию', () => {
    const player = hotSeat()
    player.send({ type: 'offerDraw' })
    player.send({ type: 'answerDraw', accept: true })
    expect(player.last('gameOver')).toMatchObject({ result: '1/2-1/2', reason: 'agreement' })
  })

  it('реванш — сразу, без обмена цветов, посреди партии тоже', () => {
    const player = hotSeat(ONE_MINUTE)
    player.move('e2', 'e4')
    player.send({ type: 'rematch' })
    expect(player.last('state')).toMatchObject({
      status: 'playing',
      moves: [],
      players: { w: WHITE, b: BLACK },
      you: ['w', 'b'],
      clock: { running: null },
    })
    player.move('d2', 'd4')
    expect(player.last('moved').san).toBe('d4')
  })

  it('флаг работает и в hot-seat', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const player = hotSeat(ONE_MINUTE)
    player.move('e2', 'e4')
    vi.advanceTimersByTime(61_000)
    expect(player.last('gameOver')).toMatchObject({ result: '1-0', reason: 'timeout' })
  })
})

describe('отмена хода (против бота)', () => {
  const BOT: PlayerIdentity = { ...identity('bot', 'Бот'), kind: 'bot' }

  /** Анна против бота: она сидит за `color`, бот — за другим цветом. */
  function againstBot(color: Color = 'w', clock: ClockConfig | null = null) {
    setup({ clock })
    const bot = connect(room).join(BOT, color === 'w' ? 'b' : 'w')
    const anna = connect(room).join(ANNA, color)
    anna.clear()
    return { anna, bot }
  }

  it('когда ход у игрока, снимает его ход и ответ бота', () => {
    const { anna, bot } = againstBot()
    anna.move('e2', 'e4')
    bot.move('e7', 'e5')
    anna.move('g1', 'f3')
    bot.move('b8', 'c6')
    anna.clear()
    bot.clear()

    anna.send({ type: 'takeback' })
    expect(anna.last('state')).toMatchObject({ moves: ['e4', 'e5'], you: ['w'], status: 'playing' })
    // Бот узнаёт об откате тем же состоянием
    expect(bot.last('state').moves).toEqual(['e4', 'e5'])

    anna.move('d2', 'd4')
    expect(anna.last('moved').ply).toBe(3)
  })

  it('пока бот думает, снимает только ход игрока', () => {
    const { anna, bot } = againstBot()
    anna.move('e2', 'e4')
    bot.move('e7', 'e5')
    anna.move('g1', 'f3')

    anna.send({ type: 'takeback' })
    expect(anna.last('state').moves).toEqual(['e4', 'e5'])
    bot.move('b8', 'c6')
    expect(bot.last('error').code).toBe('not-your-turn')
  })

  it('играя чёрными, отменяет только свой ход и ответ бота', () => {
    const { anna, bot } = againstBot('b')
    bot.move('e2', 'e4')
    anna.move('e7', 'e5')
    bot.move('g1', 'f3')

    anna.send({ type: 'takeback' })
    expect(anna.last('state')).toMatchObject({ moves: ['e4'], you: ['b'] })
  })

  it('без ходов игрока отменять нечего', () => {
    const { anna, bot } = againstBot('b')
    anna.send({ type: 'takeback' })
    expect(anna.last('error').code).toBe('takeback-unavailable')

    bot.move('e2', 'e4')
    anna.send({ type: 'takeback' })
    expect(anna.last('error').code).toBe('takeback-unavailable')
    expect(host.snapshot('local-1').moves).toEqual(['e4'])
  })

  it('снимает предложение ничьей', () => {
    const { anna, bot } = againstBot()
    anna.move('e2', 'e4')
    bot.move('e7', 'e5')
    anna.send({ type: 'offerDraw' })
    anna.send({ type: 'takeback' })
    expect(anna.last('state').drawOffer).toBeNull()
  })

  it('после окончания партии и в hot-seat не работает', () => {
    const { anna } = againstBot()
    anna.move('e2', 'e4')
    anna.send({ type: 'resign' })
    anna.send({ type: 'takeback' })
    expect(anna.last('error').code).toBe('game-over')

    host.stop()
    room = createLocalRoom()
    host = createGameHost({
      transport: room.host,
      clock: null,
      hotSeat: { w: ANNA, b: BOT },
    })
    host.start()
    const player = connect(room).join(ANNA)
    player.send({ type: 'takeback' })
    expect(player.last('error').code).toBe('unsupported')
  })

  describe('часы', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(0)
    })

    it('не возвращаются; после отмены идут у игрока', () => {
      const { anna, bot } = againstBot('w', ONE_MINUTE)
      anna.move('e2', 'e4')
      vi.advanceTimersByTime(2000)
      bot.move('e7', 'e5')
      anna.move('g1', 'f3')
      vi.advanceTimersByTime(3000)

      anna.send({ type: 'takeback' })
      // Остатки остаются как были (в том числе инкремент за отменённый ход), а идут часы игрока
      expect(anna.last('state').clock).toEqual({
        config: ONE_MINUTE,
        remaining: { w: 61_000, b: 56_000 },
        running: 'w',
      })
    })

    it('возврат в начальную позицию сбрасывает часы', () => {
      const { anna } = againstBot('w', ONE_MINUTE)
      anna.move('e2', 'e4')
      vi.advanceTimersByTime(2000)
      anna.send({ type: 'takeback' })
      expect(anna.last('state')).toMatchObject({
        moves: [],
        clock: { remaining: { w: 60_000, b: 60_000 }, running: null },
      })
    })
  })
})

describe('жизненный цикл', () => {
  it('после stop сообщения не обрабатываются, после start — снова', () => {
    const [anna] = twoPlayers()
    host.stop()
    anna.clear()
    anna.move('e2', 'e4')
    expect(anna.received).toEqual([])

    host.start()
    // Клиенты после перезапуска входят заново
    anna.join(ANNA)
    expect(anna.last('state').you).toEqual(['w'])
  })

  it('повторный start не подписывает второй раз', () => {
    const [anna] = twoPlayers()
    host.start()
    anna.move('e2', 'e4')
    expect(anna.of('moved')).toHaveLength(1)
  })

  it('snapshot клиента, которого нет, — без мест', () => {
    twoPlayers()
    expect(host.snapshot('unknown').you).toEqual([])
  })
})

/** Проверка типа: снимок хоста — валидное сообщение протокола. */
describe('снимок состояния', () => {
  it('соответствует схеме протокола', async () => {
    const { parseServerMessage } = await import('@/shared/api')
    twoPlayers({ clock: ONE_MINUTE })
    const snapshot: StateMessage = host.snapshot('local-1')
    expect(parseServerMessage(snapshot)).toEqual(snapshot)
  })
})
