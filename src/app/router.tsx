import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/pages/home'
import { ROUTES } from '@/shared/config'

export const router = createBrowserRouter([
  { path: ROUTES.home, Component: HomePage },
  {
    path: ROUTES.local,
    lazy: async () => ({ Component: (await import('@/pages/local-game')).LocalGamePage }),
  },
  {
    path: ROUTES.bot,
    lazy: async () => ({ Component: (await import('@/pages/bot-game')).BotGamePage }),
  },
  {
    path: ROUTES.kit,
    lazy: async () => ({ Component: (await import('@/pages/kit')).KitPage }),
  },
])
