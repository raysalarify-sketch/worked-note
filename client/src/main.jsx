import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Ensure root exists
let root = document.getElementById('root');
if (!root) {
  root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
