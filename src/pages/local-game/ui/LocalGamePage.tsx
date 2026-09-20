import { useMemo } from 'react'
import { useStore } from 'zustand'
import {
  describeStatus,
  selectCheckedKingSquare,
  selectLastMove,
  selectPositionAt,
  type GameStore,
} from '@/entities/game'
import { useBoardOrientation } from '@/features/flip-board'
import { useHistoryNavigation } from '@/features/navigate-history'
import { AppHeader } from '@/widgets/app-header'
import { ChessBoard } from '@/widgets/chess-board'
import { GameControls } from '@/widgets/game-controls'
import { GameResultModal } from '@/widgets/game-result-modal'
import { GameSidebar } from '@/widgets/game-sidebar'
import { LOCAL_PLAYERS } from '../model/createLocalGame'
import { useLocalGame } from '../model/useLocalGame'
import { TimeControlPicker } from './TimeControlPicker'
import styles from './LocalGamePage.module.css'

function pgnHeaders(): Record<string, string> {
  return {
    Event: 'Локальная партия',
    Site: 'Chess Online',
    Date: new Date().toISOString().slice(0, 10).replaceAll('-', '.'),
    White: LOCAL_PLAYERS.w.displayName,
    Black: LOCAL_PLAYERS.b.displayName,
  }
}

/** Партия за одним экраном (hot-seat): доска, часы, ходы, сдача, ничья и итог. */
export function LocalGamePage() {
  const { client, timeControl, selectTimeControl, newGame } = useLocalGame()
  const { orientation, flip } = useBoardOrientation('w')

  const state: GameStore = useStore(client.game)
  const { clock, drawOffer, you } = useStore(client.store)
  const history = useHistoryNavigation(state.moves.length)
  const over = state.result !== null
  // В прошлой позиции доска только показывает; в текущей берём состояние стора как есть
  const past = useMemo(
    () => (history.isLive ? null : selectPositionAt(state, history.ply)),
    [state, history.isLive, history.ply],
  )

  const startNewGame = () => {
    history.goLive()
    newGame()
  }

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.layout}>
        <div className={styles.boardColumn}>
          <ChessBoard
            pieces={past?.pieces ?? state.pieces}
            turn={past?.turn ?? state.turn}
            legalMoves={past ? [] : state.legalMoves}
            lastMove={past ? past.lastMove : selectLastMove(state)}
            checkedSquare={past ? past.checkedSquare : selectCheckedKingSquare(state)}
            orientation={orientation}
            movableColors={over || past ? [] : you}
            onMove={client.move}
          />
        </div>
        <div className={styles.sideColumn}>
          <GameSidebar
            game={state}
            players={LOCAL_PLAYERS}
            clock={clock}
            orientation={orientation}
            history={history}
            status={describeStatus(state)}
          />
          {state.moves.length === 0 && (
            <TimeControlPicker value={timeControl} onChange={selectTimeControl} />
          )}
          <GameControls
            actor={state.turn}
            inProgress={!over}
            plyCount={state.moves.length}
            onFlip={flip}
            drawOfferedBy={drawOffer}
            onResign={client.resign}
            onOfferDraw={client.offerDraw}
            onAnswerDraw={client.answerDraw}
            onNewGame={startNewGame}
          />
        </div>
      </main>
      <GameResultModal
        result={state.result}
        getPgn={() => state.pgn(pgnHeaders())}
        onNewGame={startNewGame}
      />
    </div>
  )
}
