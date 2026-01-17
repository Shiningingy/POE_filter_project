import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { setupDemoAdapter } from './services/demoAdapter'

setupDemoAdapter();

// Disable default context menu globally
window.oncontextmenu = (e) => {
    e.preventDefault();
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
