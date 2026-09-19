import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { piecesFromFen } from './fen'
import { canDeliverMate } from './insufficient'
import { createChessJsRules } from './rules'
import type {
  ChessRules,
  ChessRulesFactory,
  Color,
  GameResult,
  LegalMove,
  MoveInput,
  MoveRecord,
  PlacedPiece,
} from './types'

export interface GameState {
  startFen: string
  fen: string
  turn: Color
  pieces: PlacedPiece[]
  moves: MoveRecord[]
  /** Пусто, когда партия окончена. */
  legalMoves: LegalMove[]
  inCheck: boolean
  /** `null` — партия идёт. */
  result: GameResult | null
}

export type MoveError = 'illegal' | 'game-over'
export type MoveOutcome = { ok: true; move: MoveRecord } | { ok: false; error: MoveError }

export interface LoadInput {
  startFen?: string
  /** Ходы в SAN с начальной позиции (для resync). */
  moves: readonly string[]
  /** Исход, определённый вне позиции (сдача, время, соглашение); иначе — по правилам. */
  result?: GameResult | null
}

export interface GameActions {
  move(input: MoveInput): MoveOutcome
  /** Отменяет последние `plies` полуходов (takeback). Только пока партия идёт. */
  undo(plies?: number): boolean
  /** `color` сдаётся. */
  resign(color: Color): boolean
  /** У `color` упал флаг. Если у соперника не хватает материала для мата — ничья. */
  flag(color: Color): boolean
  agreeDraw(): boolean
  /** Заменяет партию; при нелегальном списке ходов состояние не меняется и вернётся `false`. */
  load(input: LoadInput): boolean
  reset(startFen?: string): void
  pgn(headers?: Record<string, string>): string
}

export type GameStore = GameState & GameActions
export type GameStoreApi = StoreApi<GameStore>

export interface CreateGameStoreOptions {
  startFen?: string
  /** Подмена реализации правил (по умолчанию — chess.js). */
  rulesFactory?: ChessRulesFactory
}

function otherColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

function snapshot(rules: ChessRules, result: GameResult | null): GameState {
  const fen = rules.fen()
  return {
    startFen: rules.startFen,
    fen,
    turn: rules.turn(),
    pieces: piecesFromFen(fen),
    moves: rules.history(),
    legalMoves: result ? [] : rules.legalMoves(),
    inCheck: rules.isCheck(),
    result,
  }
}

export function createGameStore(options: CreateGameStoreOptions = {}): GameStoreApi {
  const rulesFactory = options.rulesFactory ?? createChessJsRules
  let rules = rulesFactory(options.startFen)

  return createStore<GameStore>()((set, get) => {
    /** Завершает партию, если она ещё идёт. */
    const finish = (result: GameResult): boolean => {
      if (get().result) return false
      set({ result, legalMoves: [] })
      return true
    }

    return {
      ...snapshot(rules, rules.outcome()),

      move: (input) => {
        if (get().result) return { ok: false, error: 'game-over' }
        const move = rules.move(input)
        if (!move) return { ok: false, error: 'illegal' }
        set(snapshot(rules, rules.outcome()))
        return { ok: true, move }
      },

      undo: (plies = 1) => {
        const { result, moves } = get()
        if (result || plies < 1 || plies > moves.length) return false
        for (let i = 0; i < plies; i++) rules.undo()
        set(snapshot(rules, null))
        return true
      },

      resign: (color) => finish({ result: color === 'w' ? '0-1' : '1-0', reason: 'resignation' }),

      flag: (color) => {
        const winner = otherColor(color)
        if (canDeliverMate(get().pieces, winner)) {
          return finish({ result: winner === 'w' ? '1-0' : '0-1', reason: 'timeout' })
        }
        return finish({ result: '1/2-1/2', reason: 'timeout-vs-insufficient-material' })
      },

      agreeDraw: () => finish({ result: '1/2-1/2', reason: 'agreement' }),

      load: ({ startFen, moves, result }) => {
        let next: ChessRules
        try {
          next = rulesFactory(startFen)
        } catch {
          return false
        }
        for (const san of moves) {
          if (!next.moveSan(san)) return false
        }
        rules = next
        set(snapshot(rules, result === undefined ? rules.outcome() : result))
        return true
      },

      reset: (startFen) => {
        rules = rulesFactory(startFen)
        set(snapshot(rules, rules.outcome()))
      },

      pgn: (headers = {}) => {
        const { result } = get()
        return rules.pgn({ ...(result ? { Result: result.result } : {}), ...headers })
      },
    }
  })
}
