export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type PromotionPiece = 'n' | 'b' | 'r' | 'q'

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
export type Square = `${File}${Rank}`

export interface Piece {
  color: Color
  type: PieceType
}

export interface PlacedPiece extends Piece {
  square: Square
}

/** Ход в том виде, в каком его присылает UI или соперник. */
export interface MoveInput {
  from: Square
  to: Square
  promotion?: PromotionPiece
}

/** Сыгранный ход. `fen` — позиция после хода. */
export interface MoveRecord {
  color: Color
  from: Square
  to: Square
  piece: PieceType
  san: string
  captured?: PieceType
  promotion?: PromotionPiece
  castle?: 'k' | 'q'
  enPassant: boolean
  fen: string
}

/** Допустимый ход из текущей позиции (для подсветки и валидации в UI). */
export interface LegalMove {
  from: Square
  to: Square
  piece: PieceType
  captured?: PieceType
  promotion?: PromotionPiece
  castle?: 'k' | 'q'
  enPassant: boolean
}

/** Результат в PGN-нотации: белые выиграли / чёрные выиграли / ничья. */
export type ResultCode = '1-0' | '0-1' | '1/2-1/2'

export type WinReason = 'checkmate' | 'timeout' | 'resignation'
export type DrawReason =
  | 'stalemate'
  | 'insufficient-material'
  | 'threefold-repetition'
  | 'fifty-moves'
  | 'agreement'
  | 'timeout-vs-insufficient-material'
export type GameOverReason = WinReason | DrawReason

export interface GameResult {
  result: ResultCode
  reason: GameOverReason
}

/** Исход, который определяется одной лишь позицией (без часов и решений игроков). */
export type PositionOutcome = GameResult

/**
 * Интерфейс правил шахмат. Единственная реализация — на `chess.js`
 * (`createChessJsRules`); `chess.js` за пределы `entities/game` не выходит.
 * Объект изменяемый: снимки состояния делает стор.
 */
export interface ChessRules {
  readonly startFen: string
  fen(): string
  turn(): Color
  isCheck(): boolean
  legalMoves(): LegalMove[]
  /** `null`, если ход нелегален. */
  move(input: MoveInput): MoveRecord | null
  /** `null`, если ход нелегален или не однозначен. */
  moveSan(san: string): MoveRecord | null
  undo(): MoveRecord | null
  history(): MoveRecord[]
  /** Партия окончена по правилам: мат, пат, повторение, 50 ходов, недостаток материала. */
  outcome(): PositionOutcome | null
  pgn(headers?: Record<string, string>): string
}

export type ChessRulesFactory = (startFen?: string) => ChessRules
