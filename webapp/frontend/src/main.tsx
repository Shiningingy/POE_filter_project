import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import App from './App.tsx'
import './index.css'
import { setupDemoAdapter } from './services/demoAdapter'

// Default to local backend, demoAdapter will intercept if active
axios.defaults.baseURL = 'http://localhost:8000';

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
