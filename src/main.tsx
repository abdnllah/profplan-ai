import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register offline Service Worker for PWA shell caching (PRD Section 3.2, 3.7)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('ProfPlan AI: Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('ProfPlan AI: Service Worker registration failed:', error);
      });
  });
}

