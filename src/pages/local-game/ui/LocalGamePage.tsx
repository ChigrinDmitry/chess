import { useState } from 'react'
import { useStore } from 'zustand'
import {
  createGameStore,
  selectCheckedKingSquare,
  selectLastMove,
  type GameOverReason,
  type GameResult,
} from '@/entities/game'
import { FlipBoardButton, useBoardOrientation } from '@/features/flip-board'
import { GlassButton, GlassPanel } from '@/shared/ui'
import { ChessBoard } from '@/widgets/chess-board'
import styles from './LocalGamePage.module.css'

const REASONS: Record<GameOverReason, string> = {
  checkmate: 'мат',
  timeout: 'время вышло',
  resignation: 'сдача',
  stalemate: 'пат',
  'insufficient-material': 'недостаточно материала',
  'threefold-repetition': 'троекратное повторение',
  'fifty-moves': 'правило 50 ходов',
  agreement: 'по соглашению',
  'timeout-vs-insufficient-material': 'время вышло, у соперника недостаточно материала',
}

function statusText(turn: 'w' | 'b', inCheck: boolean, result: GameResult | null): string {
  if (result) {
    const outcome =
      result.result === '1-0'
        ? 'Победили белые'
        : result.result === '0-1'
          ? 'Победили чёрные'
          : 'Ничья'
    return `${outcome} — ${REASONS[result.reason]}`
  }
  const side = turn === 'w' ? 'белых' : 'чёрных'
  return inCheck ? `Ход ${side}, шах` : `Ход ${side}`
}

/** Партия за одним экраном (hot-seat). Часы, список ходов и итоговая модалка — этап 4. */
export function LocalGamePage() {
  const [game] = useState(() => createGameStore())
  const { orientation, flip } = useBoardOrientation('w')

  const state = useStore(game)
  const lastMove = selectLastMove(state)
  const checked = selectCheckedKingSquare(state)

  return (
    <main className={styles.page}>
      <GlassPanel padding="sm" radius="xl" className={styles.status}>
        <span role="status">{statusText(state.turn, state.inCheck, state.result)}</span>
      </GlassPanel>
      <ChessBoard
        pieces={state.pieces}
        turn={state.turn}
        legalMoves={state.legalMoves}
        lastMove={lastMove}
        checkedSquare={checked}
        orientation={orientation}
        movableColors={state.result ? [] : ['w', 'b']}
        onMove={state.move}
      />
      <div className={styles.actions}>
        <FlipBoardButton onFlip={flip} />
        <GlassButton onClick={() => state.reset()}>Новая партия</GlassButton>
      </div>
    </main>
  )
}
