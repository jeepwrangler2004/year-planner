import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function mount() {
  const container = document.getElementById('root')
  if (!container) {
    setTimeout(mount, 50)
    return
  }
  try {
    createRoot(container, {
      onUncaughtError: (err) => console.error('React error:', err),
    }).render(<App />)
  } catch(e) {
    console.error('Mount error:', e)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
