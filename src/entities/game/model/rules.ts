import { Chess } from 'chess.js'
import type { Move } from 'chess.js'
import { START_FEN } from './fen'
import type {
  ChessRules,
  Color,
  LegalMove,
  MoveInput,
  MoveRecord,
  PieceType,
  PositionOutcome,
  PromotionPiece,
  Square,
} from './types'

function castleOf(flags: string): 'k' | 'q' | undefined {
  if (flags.includes('k')) return 'k'
  if (flags.includes('q')) return 'q'
  return undefined
}

/** Общие поля хода; необязательные добавляются только если заданы (exactOptionalPropertyTypes). */
function describe(m: Move) {
  const castle = castleOf(m.flags)
  return {
    from: m.from as Square,
    to: m.to as Square,
    piece: m.piece as PieceType,
    enPassant: m.flags.includes('e'),
    ...(m.captured ? { captured: m.captured as PieceType } : {}),
    ...(m.promotion ? { promotion: m.promotion as PromotionPiece } : {}),
    ...(castle ? { castle } : {}),
  }
}

function toRecord(m: Move): MoveRecord {
  return { ...describe(m), color: m.color as Color, san: m.san, fen: m.after }
}

export function createChessJsRules(startFen: string = START_FEN): ChessRules {
  const chess = new Chess(startFen)

  function tryMove(move: string | MoveInput): MoveRecord | null {
    try {
      return toRecord(chess.move(move))
    } catch {
      return null
    }
  }

  return {
    startFen,
    fen: () => chess.fen(),
    turn: () => chess.turn(),
    isCheck: () => chess.isCheck(),
    legalMoves: (): LegalMove[] => chess.moves({ verbose: true }).map(describe),
    move: (input) => tryMove(input),
    moveSan: (san) => tryMove(san),
    undo: () => {
      const undone = chess.undo()
      return undone ? toRecord(undone) : null
    },
    history: () => chess.history({ verbose: true }).map(toRecord),
    outcome: (): PositionOutcome | null => {
      // Порядок важен: мат на 50-м ходу — всё ещё мат.
      if (chess.isCheckmate()) {
        return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' }
      }
      if (chess.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' }
      if (chess.isInsufficientMaterial()) {
        return { result: '1/2-1/2', reason: 'insufficient-material' }
      }
      if (chess.isThreefoldRepetition()) {
        return { result: '1/2-1/2', reason: 'threefold-repetition' }
      }
      if (chess.isDrawByFiftyMoves()) return { result: '1/2-1/2', reason: 'fifty-moves' }
      return null
    },
    pgn: (headers = {}) => {
      // PGN строим на копии: заголовки не должны попадать в рабочую партию.
      const copy = new Chess(startFen)
      for (const m of chess.history()) copy.move(m)
      copy.setHeader('Result', headers['Result'] ?? '*')
      for (const [key, value] of Object.entries(headers)) copy.setHeader(key, value)
      return copy.pgn()
    },
  }
}
