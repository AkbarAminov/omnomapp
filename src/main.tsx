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
        openTelegramLink(url: string): void;
        openLink(url: string, options?: { try_instant_view?: boolean }): void;
        MainButton: {
          show(): void;
          hide(): void;
          setText(text: string): void;
          onClick(fn: () => void): void;
        };
        CloudStorage: {
          setItem(key: string, value: string, callback?: (err: unknown) => void): void;
          getItem(key: string, callback: (err: unknown, value: string | undefined) => void): void;
          getItems(keys: string[], callback: (err: unknown, values: Record<string, string>) => void): void;
          getKeys(callback: (err: unknown, keys: string[]) => void): void;
        };
        LocationManager: {
          isInited: boolean;
          isLocationAvailable: boolean;
          isAccessRequested: boolean;
          isAccessGranted: boolean;
          init(callback?: () => void): void;
          getLocation(callback: (data: { latitude: number; longitude: number } | null) => void): void;
          openSettings(): void;
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
