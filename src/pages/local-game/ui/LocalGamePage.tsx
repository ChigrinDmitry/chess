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
import type { PlayerIdentity } from '@/entities/player'
import { useBoardOrientation } from '@/features/flip-board'
import { useHistoryNavigation } from '@/features/navigate-history'
import { AppHeader } from '@/widgets/app-header'
import { ChessBoard } from '@/widgets/chess-board'
import { GameControls } from '@/widgets/game-controls'
import { GameResultModal } from '@/widgets/game-result-modal'
import { GameSidebar } from '@/widgets/game-sidebar'
import { useLocalGame } from '../model/useLocalGame'
import { TimeControlPicker } from './TimeControlPicker'
import styles from './LocalGamePage.module.css'

const PLAYERS: Record<Color, PlayerIdentity> = {
  w: {
    kind: 'guest',
    id: 'local-white',
    displayName: 'Белые',
    avatar: { hue: 220, initials: 'Б' },
  },
  b: {
    kind: 'guest',
    id: 'local-black',
    displayName: 'Чёрные',
    avatar: { hue: 20, initials: 'Ч' },
  },
}

function pgnHeaders(): Record<string, string> {
  return {
    Event: 'Локальная партия',
    Site: 'Chess Online',
    Date: new Date().toISOString().slice(0, 10).replaceAll('-', '.'),
    White: PLAYERS.w.displayName,
    Black: PLAYERS.b.displayName,
  }
}

/** Партия за одним экраном (hot-seat): доска, часы, ходы, сдача, ничья и итог. */
export function LocalGamePage() {
  const { game, clock, timeControl, selectTimeControl, move, newGame } = useLocalGame()
  const { orientation, flip } = useBoardOrientation('w')

  const state: GameStore = useStore(game)
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
            movableColors={over || past ? [] : ['w', 'b']}
            onMove={move}
          />
        </div>
        <div className={styles.sideColumn}>
          <GameSidebar
            game={state}
            players={PLAYERS}
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
            onResign={(color) => state.resign(color)}
            onAgreeDraw={() => state.agreeDraw()}
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
