import { clientMessageSchema, parseClientMessage, parseServerMessage } from './protocol'

const identity = {
  kind: 'guest',
  id: 'g1',
  displayName: 'Смелый конь',
  avatar: { hue: 120, initials: 'СК' },
}

describe('protocol: сообщения клиента', () => {
  it('принимает корректные сообщения', () => {
    expect(parseClientMessage({ type: 'join', identity, color: 'b' })).toMatchObject({
      type: 'join',
    })
    expect(parseClientMessage({ type: 'move', from: 'e2', to: 'e4' })).toEqual({
      type: 'move',
      from: 'e2',
      to: 'e4',
    })
    expect(
      parseClientMessage({ type: 'move', from: 'e7', to: 'e8', promotion: 'q' }),
    ).toMatchObject({ promotion: 'q' })
    expect(parseClientMessage({ type: 'answerDraw', accept: true })).toEqual({
      type: 'answerDraw',
      accept: true,
    })
    for (const type of ['resign', 'offerDraw', 'rematch', 'takeback', 'ping']) {
      expect(parseClientMessage({ type })).toEqual({ type })
    }
  })

  it.each([
    ['не объект', 'move'],
    ['неизвестный тип', { type: 'explode' }],
    ['клетка вне доски', { type: 'move', from: 'e9', to: 'e4' }],
    ['клетка не строкой', { type: 'move', from: 12, to: 'e4' }],
    ['превращение в короля', { type: 'move', from: 'e7', to: 'e8', promotion: 'k' }],
    ['accept не булев', { type: 'answerDraw', accept: 'yes' }],
    ['без типа', { from: 'e2', to: 'e4' }],
  ])('отклоняет: %s', (_name, input) => {
    expect(parseClientMessage(input)).toBeNull()
  })

  describe('токен в join', () => {
    const join = (token: unknown) => ({ type: 'join', identity, token })

    it('необязателен и принимается нормальной длины', () => {
      expect(parseClientMessage({ type: 'join', identity })).not.toBeNull()
      expect(parseClientMessage(join('a'.repeat(32)))).toMatchObject({ token: 'a'.repeat(32) })
    })

    it.each([
      ['короткий', 'abc'],
      ['слишком длинный', 'a'.repeat(129)],
      ['не строка', 42],
    ])('отклоняет: %s', (_name, token) => {
      expect(parseClientMessage(join(token))).toBeNull()
    })
  })

  describe('ник в join', () => {
    const join = (displayName: string) => ({ type: 'join', identity: { ...identity, displayName } })

    it('обрезает пробелы по краям', () => {
      const msg = clientMessageSchema.parse(join('  Ладья  '))
      expect(msg.type === 'join' && msg.identity.displayName).toBe('Ладья')
    })

    it.each(['', '   ', 'x'.repeat(25), '<script>', 'a\nb', 'name😀'])('отклоняет %j', (name) => {
      expect(parseClientMessage(join(name))).toBeNull()
    })

    it.each(['Ivan_1', "O'Neil", 'Ана-Мария', 'x'.repeat(24)])('принимает %j', (name) => {
      expect(parseClientMessage(join(name))).not.toBeNull()
    })
  })

  it('отклоняет оттенок аватара вне 0–359', () => {
    const avatar = { hue: 360, initials: 'A' }
    expect(parseClientMessage({ type: 'join', identity: { ...identity, avatar } })).toBeNull()
  })
})

describe('protocol: сообщения сервера', () => {
  const state = {
    type: 'state',
    status: 'playing',
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    moves: ['e4'],
    clock: {
      config: { initialMs: 60_000, incrementMs: 0 },
      remaining: { w: 60_000, b: 60_000 },
      running: 'b',
    },
    result: null,
    players: { w: identity, b: null },
    you: ['w'],
    drawOffer: null,
  }

  it('принимает state, moved, gameOver и остальные', () => {
    expect(parseServerMessage(state)).not.toBeNull()
    expect(
      parseServerMessage({ ...state, clock: null, result: { result: '1-0', reason: 'timeout' } }),
    ).not.toBeNull()
    expect(
      parseServerMessage({
        type: 'moved',
        ply: 1,
        san: 'e4',
        move: { from: 'e2', to: 'e4' },
        fen: state.fen,
        clock: null,
      }),
    ).not.toBeNull()
    expect(
      parseServerMessage({ type: 'gameOver', result: '0-1', reason: 'resignation', clock: null }),
    ).not.toBeNull()
    expect(parseServerMessage({ type: 'drawOffered', by: 'w' })).not.toBeNull()
    expect(parseServerMessage({ type: 'drawDeclined' })).not.toBeNull()
    expect(parseServerMessage({ type: 'rematchRequested', by: 'b' })).not.toBeNull()
    expect(
      parseServerMessage({ type: 'opponentPresence', color: 'w', online: false }),
    ).not.toBeNull()
    expect(parseServerMessage({ type: 'error', code: 'illegal-move' })).not.toBeNull()
  })

  it.each([
    ['отрицательное время', { ...state, clock: { ...state.clock!, remaining: { w: -1, b: 0 } } }],
    ['неизвестный статус', { ...state, status: 'paused' }],
    [
      'ход нулевым полуходом',
      { type: 'moved', ply: 0, san: 'e4', move: { from: 'e2', to: 'e4' }, fen: '', clock: null },
    ],
    ['неизвестная причина', { type: 'gameOver', result: '1-0', reason: 'magic', clock: null }],
    ['неизвестный код ошибки', { type: 'error', code: 'oops' }],
  ])('отклоняет: %s', (_name, input) => {
    expect(parseServerMessage(input)).toBeNull()
  })
})
