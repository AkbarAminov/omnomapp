import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initAuth } from './lib/auth';
import { startAppSession } from './logic/metrics';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        close(): void;
        colorScheme: 'light' | 'dark';
        platform: string;
        themeParams: Record<string, string>;
        disableVerticalSwipes?(): void;
        viewportHeight?: number;
        viewportStableHeight?: number;
        onEvent?(eventType: string, callback: () => void): void;
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
      // expand()/disableVerticalSwipes() — только телефон. На десктопе (macos/tdesktop/web)
      // приложение рисуется как компактное окно внутри страницы, а не растянутая вкладка:
      // раздувать его на весь экран или трогать свайпы там не нужно и нечему мешать.
      // requestFullscreen() сознательно нигде не вызывается — отказались от него.
      if (tg.platform === 'ios' || tg.platform === 'android') {
        tg.expand();
        tg.disableVerticalSwipes?.();
      }
      // 100dvh внутри WebView Telegram ненадёжен — особенно на телефоне он не всегда
      // пересчитывается синхронно с реальной высотой, из-за чего контейнер экрана оказывается
      // на несколько пикселей выше или ниже настоящего viewport: появляется лишний скролл
      // (пустота под кнопками) там, где экран задуман нескроллящимся. viewportHeight Telegram
      // шлёт сам и обновляет событием — это канонический способ для Mini Apps, не полагающийся
      // на dvh вообще. Используется как переменная с запасным 100dvh вне Telegram.
      const syncViewportHeight = () => {
        const h = tg.viewportStableHeight ?? tg.viewportHeight;
        if (h) document.documentElement.style.setProperty('--tg-vh', `${h}px`);
      };
      syncViewportHeight();
      [150, 350, 700, 1200].forEach((ms) => setTimeout(syncViewportHeight, ms));
      tg.onEvent?.('viewportChanged', syncViewportHeight);
    }
    // Fire-and-forget: must not delay first render or ever surface to the UI. The session
    // insert needs auth.uid(), so it's chained after initAuth rather than fired in parallel.
    void initAuth().then(() => {
      const start_param = (tg as any)?.initDataUnsafe?.start_param ?? null;
      startAppSession(start_param, tg?.platform ?? null);
    });
  }, []);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
