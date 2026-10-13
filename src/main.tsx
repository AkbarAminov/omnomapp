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
        isVersionAtLeast?(version: string): boolean;
        requestFullscreen?(): void;
        disableVerticalSwipes?(): void;
        safeAreaInset?: { top: number; bottom: number; left: number; right: number };
        contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
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
      tg.expand();
      // 100dvh внутри WebView Telegram ненадёжен — особенно в фуллскрине он не всегда
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
      // Полноэкранный режим (Bot API 8.0+) убирает нативную шапку Telegram («Закрыть /
      // OmNom / ⋯»); контент тогда рисуется прямо под системным статус-баром. safeAreaInset —
      // вырез/home-indicator устройства, contentSafeAreaInset — место под собственные плавающие
      // элементы Telegram поверх фуллскрина. CSS env(safe-area-inset-*) внутри их WebView в этом
      // режиме не отражает то же самое, поэтому Telegram отдаёт оба числом и шлёт события при
      // их изменении — переносим в CSS-переменную, которую читают верхние отступы экранов.
      if (tg.isVersionAtLeast?.('8.0')) {
        tg.requestFullscreen?.();
        // Без нативной шапки вертикальные свайпы на контенте больше никто не перехватывает —
        // Telegram сам начинает читать их как жест закрытия/сворачивания, из-за чего WebView
        // отвечает резиновым скроллом (на миг показывает пустоту снизу) на свайпе вверх по
        // карточке вопроса, хотя этот экран не должен скроллиться вообще. У своего же свайпа
        // есть выделенный ответ «Без разницы» — Telegram не должен его трогать.
        tg.disableVerticalSwipes?.();
        const syncSafeArea = () => {
          const top = (tg.safeAreaInset?.top ?? 0) + (tg.contentSafeAreaInset?.top ?? 0);
          document.documentElement.style.setProperty('--tg-safe-top', `${top}px`);
        };
        // requestFullscreen() — переход анимированный и асинхронный; сразу после вызова
        // safeAreaInset/contentSafeAreaInset ещё могут быть нулями. Опрашиваем несколько раз
        // первую секунду, а не только по событиям — contentSafeAreaInset (место под плавающие
        // «Закрыть/⌄/⋯» Telegram) на практике не всегда шлёт contentSafeAreaChanged вовремя.
        syncSafeArea();
        [150, 350, 700, 1200].forEach((ms) => setTimeout(syncSafeArea, ms));
        tg.onEvent?.('safeAreaChanged', syncSafeArea);
        tg.onEvent?.('contentSafeAreaChanged', syncSafeArea);
        tg.onEvent?.('fullscreenChanged', syncSafeArea);
      }
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
