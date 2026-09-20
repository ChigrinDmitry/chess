# Chess Online

Шахматы в браузере в стиле «liquid glass»: партия за одним экраном, против бота и (в разработке) онлайн по ссылке.
Только фронтенд — бэкенда нет, бот работает прямо в браузере.

- **Локальная партия** (`/local`) — двое за одним экраном: часы, список ходов, сдача, ничья, PGN.
- **Партия с ботом** (`/bot`) — 8 уровней от новичка до ~2000 Elo, выбор цвета и контроля времени, отмена хода.
- **Онлайн между вкладками** — в плане (этап 6), протокол и хост уже готовы.

Стек: React 19, TypeScript 6, Vite 8, Zustand, Zod, `chess.js` (правила), CSS Modules. Архитектура — Feature-Sliced Design.

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
```

| Команда             | Что делает                                    |
| ------------------- | --------------------------------------------- |
| `npm test`          | Vitest, все тесты                             |
| `npm run lint`      | oxlint                                        |
| `npm run lint:fsd`  | Steiger: проверка слоёв Feature-Sliced Design |
| `npm run typecheck` | `tsc -b`                                      |
| `npm run format`    | Prettier                                      |
| `npm run build`     | проверка типов и сборка в `dist/`             |

CI (`.github/workflows/ci.yml`) прогоняет `format:check`, `lint`, `lint:fsd`, `typecheck`, `test`, `build`.

## Документация

- [docs/TZ.md](docs/TZ.md) — техническое задание: требования, протокол, архитектура.
- [docs/ROADMAP.md](docs/ROADMAP.md) — этапы разработки и статус.
- [CLAUDE.md](CLAUDE.md) — устройство кода и подводные камни (для разработчиков и ассистентов).

## Бот и Stockfish

Бот играет на [Stockfish](https://github.com/official-stockfish/Stockfish) (сборка [stockfish.js](https://github.com/nmrugg/stockfish.js) 19, lite, однопоточная).
Движок запускается в Web Worker, лежит в `public/engine/` и подгружается только на странице бота; заголовки `COOP`/`COEP` не нужны.
Бот — обычный игрок, говорящий на том же протоколе, что и человек, а сам движок спрятан за интерфейсом `ChessEngine`, поэтому его можно заменить.

Сила уровней 1–8 задаётся `Skill Level` и глубиной поиска. Значения Elo в интерфейсе — ориентир, а не измеренный рейтинг.
Подробности сборки, контрольные суммы и порядок обновления — в [public/engine/README.md](public/engine/README.md).

## Лицензия

Проект распространяется под **GNU GPL v3** — см. [LICENSE](LICENSE). Это требование Stockfish (GPLv3): приложение отдаёт его пользователям вместе со своим кодом,
поэтому и весь проект открыт на условиях GPL. Stockfish © The Stockfish developers, Stockfish.js © Chess.com, LLC (GPLv3); нейросеть — Chris Bao (sscg13).
