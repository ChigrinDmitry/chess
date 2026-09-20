# Шахматный движок

Здесь лежит сборка **Stockfish.js 19 (lite, однопоточная)** — движок бота. Файлы отдаются как
статика и запускаются в Web Worker (`entities/bot`), в основной бандл они не входят.

| Файл                            | Что это                           |
| ------------------------------- | --------------------------------- |
| `stockfish-19-lite-single.js`   | обвязка воркера (Emscripten)      |
| `stockfish-19-lite-single.wasm` | движок и нейросеть оценки (1,7 МБ) |
| `COPYING.txt`                   | текст лицензии GPLv3              |

- Исходники и сборки: <https://github.com/nmrugg/stockfish.js> (релиз v19.0.0, npm-пакет `stockfish@19.0.0`).
- Исходный Stockfish: <https://github.com/official-stockfish/Stockfish>.
- Лицензия: **GPLv3**. Нейросеть — Chris Bao (sscg13), <https://tests.stockfishchess.org/nns?network_name=nn-61e7af4bb97d>.

Файлы взяты из `node_modules/stockfish/bin/` без изменений. Контрольные суммы SHA-256:

```
d3344124ab067fb0b90ee77873bb8e9fbf5fc01bc525fe714b0f942581e889e6  stockfish-19-lite-single.js
57ac2d72312aba346760e3f173f687a8c211208e97a87268436f7f0e10bb5387  stockfish-19-lite-single.wasm
```

## Почему именно lite-single

- Однопоточная сборка не требует cross-origin isolation (заголовков `COOP`/`COEP`), поэтому
  работает на любом статическом хостинге и в Safari 16+.
- Lite-сеть весит 1,7 МБ вместо ≈95 МБ у полной и всё равно заметно сильнее любого человека, а
  для уровней бота 1–8 (до ~2100 Elo) сила ограничивается настройками.
- Воркер сам находит `.wasm` рядом: имя берётся из адреса скрипта заменой `.js` → `.wasm`,
  поэтому оба файла должны лежать в одной папке под одним именем.

## Как обновить

1. `npm pack stockfish@<версия>`, взять `bin/stockfish-<версия>-lite-single.{js,wasm}` и `Copying.txt`.
2. Заменить файлы здесь и обновить суммы выше.
3. Поправить `ENGINE_SCRIPT` в `src/entities/bot/model/stockfishEngine.ts`.
4. Проверить в браузере, что бот отвечает на всех уровнях, а соседние уровни по-прежнему усиливаются (матчи между ними, движок для запуска в Node копируется за пределы репозитория: из-за `"type": "module"` в `package.json` рядом с проектом он не стартует).

Оба `.js` и `.wasm` исключены из Prettier и oxlint (`.prettierignore`, `.oxlintrc.json`).
