import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        close(): void;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        MainButton: {
          show(): void;
          hide(): void;
          setText(text: string): void;
          onClick(fn: () => void): void;
        };
      };
    };
  }
}

function Root() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
