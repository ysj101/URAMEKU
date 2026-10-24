import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './app/tokens.css';
import './app/global.css';
import './app/motion.css';
import './app/layout.css';
import './app/screens/collage.css';

import { initMotionPreference } from './app/motionSettings';
import { getSoundManager, installAutoUnlock } from './audio/soundManager';

initMotionPreference();
installAutoUnlock(getSoundManager());

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root が見つかりません');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
