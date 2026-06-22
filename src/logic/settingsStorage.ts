function getCS() {
  return window.Telegram?.WebApp?.CloudStorage;
}

// ── Diet restrictions ─────────────────────────────────────────────────────────

const DIET_KEY = 'omnom_diet';

export function saveDiet(restrictions: string[]): void {
  try { getCS()?.setItem(DIET_KEY, JSON.stringify(restrictions)); } catch {}
}

export function loadDiet(onLoad: (items: string[]) => void): void {
  const cs = getCS();
  if (!cs) { onLoad([]); return; }
  try {
    cs.getItem(DIET_KEY, (_err, value) => {
      if (!value) { onLoad([]); return; }
      try { onLoad(JSON.parse(value) as string[]); } catch { onLoad([]); }
    });
  } catch { onLoad([]); }
}

// ── Language ──────────────────────────────────────────────────────────────────

const LANG_KEY = 'omnom_lang';

export function saveLanguage(lang: string): void {
  try { getCS()?.setItem(LANG_KEY, lang); } catch {}
}

export function loadLanguage(onLoad: (lang: string) => void): void {
  const cs = getCS();
  if (!cs) { onLoad('ru'); return; }
  try {
    cs.getItem(LANG_KEY, (_err, value) => { onLoad(value ?? 'ru'); });
  } catch { onLoad('ru'); }
}
