import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app'
import { initTheme } from '@/shared/lib/theme'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

initTheme()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
