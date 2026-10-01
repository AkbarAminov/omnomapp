// Картинка результата для шеринга: это отдельный ассет в стиле OMNOM, а не скриншот
// интерфейса. Формат 9:16 — чтобы её можно было отправить человеку или выложить в Stories.
import type { Dish } from './engine';

const W = 1080;
const H = 1920;
const CREAM = '#FFF1DC';
const BROWN = '#6C2912';
const ORANGE = '#F48924';

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string, crossOrigin = true): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Переносим название по словам и подбираем кегль так, чтобы влезло не больше двух строк.
function layoutTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): { lines: string[]; size: number } {
  for (const size of [96, 86, 76, 66, 58, 50]) {
    ctx.font = `900 ${size}px Inter, sans-serif`;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { lines, size };
  }
  ctx.font = `900 50px Inter, sans-serif`;
  return { lines: [text], size: 50 };
}

export async function buildShareCard(dish: Dish, name: string, caption: string): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await (document as any).fonts?.ready;

    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, W, H);

    const photo = dish.image ? await loadImage(dish.image) : null;
    const cardX = 80;
    const cardY = 430;
    const cardW = W - cardX * 2;
    const cardH = cardW;

    ctx.save();
    roundedRect(ctx, cardX, cardY, cardW, cardH, 80);
    ctx.clip();
    if (photo) {
      // cover-кроп: пропорции фотографии не искажаются.
      const scale = Math.max(cardW / photo.width, cardH / photo.height);
      const dw = photo.width * scale;
      const dh = photo.height * scale;
      ctx.drawImage(photo, cardX + (cardW - dw) / 2, cardY + (cardH - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#FFE4BD';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.font = '400 320px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dish.emoji || '🍽️', W / 2, cardY + cardH / 2);
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = ORANGE;
    ctx.font = '600 38px Inter, sans-serif';
    const spaced = caption.toUpperCase().split('').join(' ');
    ctx.fillText(spaced, W / 2, cardY - 70);

    const title = layoutTitle(ctx, name, cardW - 40);
    ctx.fillStyle = BROWN;
    let ty = cardY + cardH + 140;
    for (const line of title.lines) {
      ctx.fillText(line, W / 2, ty);
      ty += title.size * 1.15;
    }

    const logo = await loadImage('/assets/logo_horizontal.svg', false);
    if (logo && logo.width > 0) {
      const lw = 320;
      const lh = (logo.height / logo.width) * lw || 90;
      ctx.drawImage(logo, (W - lw) / 2, H - 200, lw, lh);
    } else {
      ctx.fillStyle = ORANGE;
      ctx.font = '900 72px Inter, sans-serif';
      ctx.fillText('omnom', W / 2, H - 150);
    }

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  } catch {
    return null;
  }
}

export type ShareOutcome = 'shared' | 'downloaded' | 'failed';

// Картинку готовим заранее: системный share и сохранение файла разрешены только внутри
// жеста пользователя, а рисование холста 1080×1920 легко выходит за это окно.
export function shareBlob(blob: Blob | null, caption: string): Promise<ShareOutcome> {
  if (!blob) return Promise.resolve(shareLink(caption));
  const file = new File([blob], 'omnom.png', { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?(data: ShareData): boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    // Вызов уходит синхронно из обработчика — иначе платформа сочтёт его без жеста.
    return nav.share({ files: [file], text: caption })
      .then((): ShareOutcome => 'shared')
      // Отмена пользователем — не ошибка; всё остальное отдаём запасным путём.
      .catch((e): ShareOutcome => ((e as Error)?.name === 'AbortError' ? 'shared' : fallback(blob, caption)));
  }
  return Promise.resolve(fallback(blob, caption));
}

// В Telegram WebView картинку часто отдать нельзя: системного share с файлом нет,
// а скачивание молча не срабатывает. Тогда уходим штатным телеграмным шерингом
// ссылки с подписью — пользователь всё равно может поделиться результатом.
function fallback(blob: Blob, caption: string): ShareOutcome {
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) return shareLink(caption);
  return save(blob);
}

function shareLink(caption: string): ShareOutcome {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.openTelegramLink) return 'failed';
  try {
    const url = encodeURIComponent(BOT_URL);
    const text = encodeURIComponent(caption);
    tg.openTelegramLink(`https://t.me/share/url?url=${url}&text=${text}`);
    return 'shared';
  } catch {
    return 'failed';
  }
}

const BOT_URL = 'https://t.me/omnom_bot';

function save(blob: Blob): ShareOutcome {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'omnom.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
