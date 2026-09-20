import type { ChessEngine } from '@/entities/bot'
import { AppHeader } from '@/widgets/app-header'
import { BotSettingsPanel } from '@/widgets/bot-settings-panel'
import { useBotGame } from '../model/useBotGame'
import { BotGameView } from './BotGameView'
import styles from './BotGamePage.module.css'

export interface BotGamePageProps {
  /** Создаёт движок бота (по умолчанию — Stockfish в воркере); в тестах подменяется. */
  createEngine?: (() => ChessEngine) | undefined
}

/** Партия с ботом: сначала настройки (уровень, цвет, время), затем сама партия. */
export function BotGamePage({ createEngine }: BotGamePageProps) {
  const { settings, setSettings, game, start, exit } = useBotGame({ createEngine })

  return (
    <div className={styles.page}>
      <AppHeader />
      {game ? (
        <BotGameView game={game} onExit={exit} />
      ) : (
        <main className={styles.setup}>
          <BotSettingsPanel value={settings} onChange={setSettings} onStart={start} />
        </main>
      )}
    </div>
  )
}
