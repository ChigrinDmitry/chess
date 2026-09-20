import { useMemo } from 'react'
import { useStore } from 'zustand'
import {
  describeStatus,
  selectCheckedKingSquare,
  selectLastMove,
  selectPositionAt,
  type Color,
  type GameStore,
} from '@/entities/game'
import { useBoardOrientation } from '@/features/flip-board'
import { useHistoryNavigation } from '@/features/navigate-history'
import { BotThinkingIndicator } from '@/features/play-vs-bot'
import { GlassButton } from '@/shared/ui'
import { ChessBoard } from '@/widgets/chess-board'
import { GameControls } from '@/widgets/game-controls'
import { GameResultModal } from '@/widgets/game-result-modal'
import { GameSidebar } from '@/widgets/game-sidebar'
import type { BotGame } from '../model/createBotGame'
import { canTakeBack } from '../model/takeback'
import styles from './BotGamePage.module.css'

export interface BotGameViewProps {
  game: BotGame
  /** Вернуться к настройкам: текущая партия отбрасывается. */
  onExit: () => void
}

/** Партия человека против бота: доска, часы, ходы, отмена хода и индикатор «бот думает». */
export function BotGameView({ game: botGame, onExit }: BotGameViewProps) {
  const { client, bot, settings } = botGame
  const state: GameStore = useStore(client.game)
  const { clock, drawOffer, you, players } = useStore(client.store)
  const botState = useStore(bot.store)

  const mine: Color = you[0] ?? settings.color
  const { orientation, flip } = useBoardOrientation(mine)
  const history = useHistoryNavigation(state.moves.length)
  const over = state.result !== null
  const past = useMemo(
    () => (history.isLive ? null : selectPositionAt(state, history.ply)),
    [state, history.isLive, history.ply],
  )

  const startNewGame = () => {
    history.goLive()
    // Идущую партию заканчивать нечем — только вернуться к настройкам; после конца — реванш
    if (over) client.rematch()
    else onExit()
  }

  const white = players.w
  const black = players.b
  if (!white || !black) return null

  const pgnHeaders = (): Record<string, string> => ({
    Event: 'Партия с ботом',
    Site: 'Chess Online',
    Date: new Date().toISOString().slice(0, 10).replaceAll('-', '.'),
    White: white.displayName,
    Black: black.displayName,
  })

  return (
    <main className={styles.layout}>
      <div className={styles.boardColumn}>
        <ChessBoard
          pieces={past?.pieces ?? state.pieces}
          turn={past?.turn ?? state.turn}
          legalMoves={past ? [] : state.legalMoves}
          lastMove={past ? past.lastMove : selectLastMove(state)}
          checkedSquare={past ? past.checkedSquare : selectCheckedKingSquare(state)}
          orientation={orientation}
          movableColors={over || past || botState.error ? [] : you}
          onMove={client.move}
        />
      </div>
      <div className={styles.sideColumn}>
        <GameSidebar
          game={state}
          players={{ w: white, b: black }}
          clock={clock}
          orientation={orientation}
          history={history}
          status={describeStatus(state)}
        />
        <BotThinkingIndicator state={botState} />
        <GameControls
          actor={mine}
          inProgress={!over}
          plyCount={state.moves.length}
          onFlip={flip}
          drawOfferedBy={drawOffer}
          onResign={client.resign}
          onOfferDraw={client.offerDraw}
          onAnswerDraw={client.answerDraw}
          onNewGame={startNewGame}
          onTakeback={client.takeback}
          canTakeback={canTakeBack(state.moves.length, state.turn, mine)}
        />
        <GlassButton variant="ghost" onClick={onExit}>
          Настройки бота
        </GlassButton>
      </div>
      <GameResultModal
        result={state.result}
        getPgn={() => state.pgn(pgnHeaders())}
        onNewGame={startNewGame}
      />
    </main>
  )
}
