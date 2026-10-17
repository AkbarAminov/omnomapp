// Клиент закрытой панели статистики. Ни одной агрегации здесь нет и быть не должно:
// всё считается в SQL (scripts/sql/014_admin_stats.sql) и отдаётся Edge Function
// admin-stats, которая перед ответом проверяет подпись Telegram initData и список
// владельцев из секрета ADMIN_TG_IDS. В браузер приходят только готовые агрегаты —
// ни строки events, ни строки users.
import { supabase } from './supabase';

export type StatsPeriod = 'today' | '7d' | '30d' | '90d' | 'all';

export const PERIOD_LABELS: Array<{ id: StatsPeriod; label: string }> = [
  { id: 'today', label: 'Сегодня' },
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: '90d', label: '90 дней' },
  { id: 'all', label: 'Всё время' },
];

export type KpiRow = { metric: string; value: number; unit: string; source: string };
export type DailyRow = {
  day: string; new_users: number; dau: number; wau_7d: number;
  visits: number; quizzes_started: number; quizzes_completed: number;
};
export type FunnelRow = { stage: string; step: number; visits: number };
export type DishRow = { list: string; dish_id: string; dish: string; cuisine: string; n: number };
export type CuisineRow = { cuisine: string; chosen: number };
export type DropoffRow = { question_id: string; question: string; step: number; abandoned: number };
export type QualityRow = { metric: string; value: number; unit: string; n: number; source: string };
export type AudienceRow = { dimension: string; label: string; count: number };
export type RetentionRow = { metric: string; users: number; base: number; pct: number; note: string };
export type VisitsRow = { bucket: string; users: number };

export type StatsPayload = {
  kpi: KpiRow[];
  kpiPrev: KpiRow[] | null;
  daily: DailyRow[];
  funnel: FunnelRow[];
  dishes: DishRow[];
  cuisines: CuisineRow[];
  dropoff: DropoffRow[];
  quality: QualityRow[];
  audience: AudienceRow[];
  retention: RetentionRow[];
  visits: VisitsRow[];
  meta: {
    period: StatsPeriod;
    from: string;
    to: string;
    prevFrom: string | null;
    timezone: string;
    excludedSelf: boolean;
    failed: string[];
    generatedAt: string;
  };
};

function initData(): string | null {
  return (window as any).Telegram?.WebApp?.initData || null;
}

// Показывать ли пункт «Статистика» в профиле. Вопрос решает сервер: клиент не знает ни
// одного админского id, поэтому в бандле его нет и подсмотреть в исходниках нечего.
// Любой ответ кроме явного admin: true считается «не админ» — молча, без тоста: обычный
// пользователь не должен даже догадываться, что такая проверка была.
export async function probeAdmin(): Promise<boolean> {
  const data_ = initData();
  if (!data_) return false;
  try {
    const { data, error } = await supabase.functions.invoke('admin-stats', {
      body: { initData: data_, probe: true },
    });
    if (error) return false;
    return data?.admin === true;
  } catch {
    return false;
  }
}

export type StatsResult =
  | { ok: true; data: StatsPayload }
  | { ok: false; reason: 'no_telegram' | 'forbidden' | 'network' | 'server' };

const cache = new Map<string, StatsPayload>();
const keyOf = (period: StatsPeriod, excludeSelf: boolean) => `${period}:${excludeSelf ? 'nodev' : 'all'}`;

export function cachedStats(period: StatsPeriod, excludeSelf: boolean): StatsPayload | null {
  return cache.get(keyOf(period, excludeSelf)) ?? null;
}

export async function fetchStats(
  period: StatsPeriod,
  excludeSelf: boolean,
  opts: { force?: boolean } = {},
): Promise<StatsResult> {
  const key = keyOf(period, excludeSelf);
  if (!opts.force) {
    const hit = cache.get(key);
    if (hit) return { ok: true, data: hit };
  }
  const data_ = initData();
  if (!data_) return { ok: false, reason: 'no_telegram' };
  try {
    const { data, error } = await supabase.functions.invoke('admin-stats', {
      body: { initData: data_, period, excludeSelf },
    });
    if (error) {
      // supabase-js прячет статус в context; 403 отличаем от «сеть легла», потому что это
      // разные сообщения для владельца: «не твой аккаунт» против «попробуй ещё раз».
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 403 || status === 401) return { ok: false, reason: 'forbidden' };
      return { ok: false, reason: status ? 'server' : 'network' };
    }
    if (!data || !data.meta) return { ok: false, reason: 'server' };
    cache.set(key, data as StatsPayload);
    return { ok: true, data: data as StatsPayload };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export function clearStatsCache(): void {
  cache.clear();
}

// ─── Мелкие помощники представления ──────────────────────────────────────────
export const kpi = (rows: KpiRow[] | null | undefined, metric: string): KpiRow | null =>
  rows?.find((r) => r.metric === metric) ?? null;

export const kpiValue = (rows: KpiRow[] | null | undefined, metric: string): number | null => {
  const row = kpi(rows, metric);
  return row ? Number(row.value) : null;
};

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',');
}

// Прирост к предыдущему периоду. Возвращает null, когда сравнивать не с чем: у «Всего
// времени» предыдущего периода нет, а делить на нулевую базу — значит показать рост на
// бесконечность там, где просто не было данных.
export function delta(
  current: KpiRow[] | null | undefined,
  prev: KpiRow[] | null | undefined,
  metric: string,
): { pct: number; absolute: number } | null {
  const now = kpiValue(current, metric);
  const before = kpiValue(prev, metric);
  if (now === null || before === null || before === 0) return null;
  return { pct: ((now - before) / before) * 100, absolute: now - before };
}
