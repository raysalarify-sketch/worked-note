import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// 긴급 에러 트래커: 화면이 하얗게 나오는 원인을 강제로 화면에 노출합니다.
window.onerror = function(msg, url, lineNo, columnNo, error) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; background: #fff1f2; color: #e11d48; font-family: sans-serif; border: 2px solid #e11d48; margin: 20px; border-radius: 8px;">
        <h2 style="margin: 0 0 10px 0;">🚨 시스템 런타임 에러 발생</h2>
        <p><b>메시지:</b> ${msg}</p>
        <p><b>위치:</b> ${lineNo}행 ${columnNo}열</p>
        <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px;">${error?.stack || 'No stack trace available'}</pre>
        <button onclick="location.reload()" style="background: #e11d48; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">새로고침</button>
      </div>
    `;
  }
  return false;
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
