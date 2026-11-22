import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './Landing';
import './lp.css';

// 前の URL（/?unlockall）で来た人は、ゲーム本体へそのまま送る
if (new URLSearchParams(window.location.search).has('unlockall')) {
  window.location.replace(`play/${window.location.search}`);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Landing />
    </StrictMode>,
  );
}
