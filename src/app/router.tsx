import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/pages/home'
import { ROUTES } from '@/shared/config'

export const router = createBrowserRouter([
  { path: ROUTES.home, Component: HomePage },
  {
    path: ROUTES.kit,
    lazy: async () => ({ Component: (await import('@/pages/kit')).KitPage }),
  },
])
