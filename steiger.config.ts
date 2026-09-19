import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Пустые слои и слайсы-заготовки допустимы на ранних этапах
    files: ['./src/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
