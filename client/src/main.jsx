import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// 강력한 서비스 워커 및 캐시 소멸 로직
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}

// 기존의 모든 요소를 강제 세척하고 새로운 유일 진입점 생성
document.body.innerHTML = '<div id="final-clean-root-v1"></div>';

createRoot(document.getElementById('final-clean-root-v1')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
