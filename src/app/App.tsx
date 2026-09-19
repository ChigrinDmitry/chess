import { RouterProvider } from 'react-router'
import { AppBackground } from '@/shared/ui'
import { router } from './router'
import './styles/index.css'

export function App() {
  return (
    <>
      <AppBackground />
      <RouterProvider router={router} />
    </>
  )
}
