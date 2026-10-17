// Закрытая панель статистики OmNom. Открывается из профиля, видна только владельцу —
// пункт в профиле рисуется по ответу сервера (probeAdmin), а сами агрегаты приходят из
// Edge Function admin-stats, которая проверяет подпись Telegram initData.
//
// Графики нарисованы руками: ни recharts, ни chart.js в зависимости не добавлено. Mini App
// грузится по мобильной сети, и 100–500 КБ библиотеки ради семи диаграмм того не стоят.
// Рейтинги и воронка — обычные div с процентной шириной (подписи переносятся сами и не
// требуют измерения текста, в отличие от SVG), график роста и кольцо кухонь — SVG.
//
// Интерфейс намеренно повторяет существующие экраны профиля: тот же SURFACE, те же
// #6C2912 / #F48924 / Inter, тот же SubPageHeader. Пользовательская часть не затронута.
//
// Тексты здесь не переведены на узбекский и не заведены в translations.ts специально:
// экран видит один человек — владелец. Заводить ~40 ключей с выдуманным переводом только
// ради типа Record<Lang, …> означало бы мусор в словаре, который никто не прочитает.
import React, { useEffect, useMemo, useState } from 'react';
import {
  PERIOD_LABELS, cachedStats, delta, fetchStats, formatNumber, kpi, kpiValue,
  type AudienceRow, type DishRow, type StatsPayload, type StatsPeriod,
} from '../lib/adminStats';

const INK = '#6C2912';
const INK_SOFT = 'rgba(108, 41, 18, 0.55)';
const ACCENT = '#F48924';
const GOOD = '#22C55E';
const BAD = '#EF4444';
const CARD = '#FFFBF4';
const LINE = '1px solid rgba(108, 41, 18, 0.1)';
const PAD = '20px';
const RADIUS = '20px';
const FONT = 'Inter, sans-serif';

const card: React.CSSProperties = {
  background: CARD, border: LINE, borderRadius: RADIUS, padding: '14px 16px',
};
const cardTitle: React.CSSProperties = {
  fontFamily: FONT, fontWeight: 700, color: INK, fontSize: '15px', margin: 0,
};
const cardNote: React.CSSProperties = {
  fontFamily: FONT, fontWeight: 500, color: INK_SOFT, fontSize: '11.5px',
  margin: '3px 0 12px', lineHeight: 1.4,
};
const sectionTitle: React.CSSProperties = {
  fontFamily: FONT, fontWeight: 900, color: INK, fontSize: '18px',
  letterSpacing: '-0.01em', margin: '26px 0 10px',
};

// ─── Строительные блоки ───────────────────────────────────────────────────────

function Skeleton({ height = 14, width = '100%' }: { height?: number; width?: string }) {
  return (
    <div
      aria-hidden
      style={{
        height, width, borderRadius: 7,
        background: 'rgba(108, 41, 18, 0.08)',
        animation: 'screenFadeIn 0.3s ease both',
      }}
    />
  );
}

function Tile({ label, value, unit, trend }: {
  label: string; value: string; unit?: string;
  trend?: { pct: number; absolute: number } | null;
}) {
  return (
    <div style={{ ...card, padding: '12px 14px' }}>
      <div style={{ fontFamily: FONT, fontWeight: 500, color: INK_SOFT, fontSize: '11px', lineHeight: 1.3 }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONT, fontWeight: 900, color: INK, fontSize: '26px',
        letterSpacing: '-0.02em', lineHeight: 1.15, marginTop: 4,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
        {unit && <span style={{ fontSize: '13px', fontWeight: 700, marginLeft: 3 }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: '11px', marginTop: 3, minHeight: 14 }}>
        {trend
          ? (
            <span style={{ color: trend.absolute >= 0 ? GOOD : BAD }}>
              {trend.absolute >= 0 ? '+' : '−'}{formatNumber(Math.abs(trend.pct))}% к прошлому периоду
            </span>
          )
          : <span style={{ color: INK_SOFT }}>нет базы для сравнения</span>}
      </div>
    </div>
  );
}

// Горизонтальные столбцы на div: подпись переносится сама, значение всегда на виду.
function HBars({ rows, accentFirst = true, highlight }: {
  rows: Array<{ label: string; value: number; hint?: string; danger?: boolean }>;
  accentFirst?: boolean;
  highlight?: number;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <Empty />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r, i) => {
        const isHot = r.danger || i === highlight || (accentFirst && i === 0 && highlight === undefined);
        return (
          <div key={`${r.label}-${i}`}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4,
              fontFamily: FONT, fontSize: '12.5px',
            }}>
              <span style={{ flex: 1, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{r.label}</span>
              <span style={{ fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(r.value)}
              </span>
              {r.hint && (
                <span style={{ fontWeight: 600, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
                  {r.hint}
                </span>
              )}
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(108, 41, 18, 0.08)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`, height: '100%', borderRadius: 4,
                background: isHot ? (r.danger ? BAD : ACCENT) : 'rgba(108, 41, 18, 0.3)',
                transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ text = 'За этот период данных нет' }: { text?: string }) {
  return (
    <div style={{
      fontFamily: FONT, fontWeight: 500, color: INK_SOFT, fontSize: '12.5px',
      padding: '14px 0', textAlign: 'center',
    }}>
      {text}
    </div>
  );
}

// График роста: столбцы — новые пользователи, линия — визиты. Один масштаб на оба ряда,
// чтобы их можно было честно сравнивать глазом.
function GrowthChart({ rows }: {
  rows: Array<{ day: string; newUsers: number; visits: number; done: number }>;
}) {
  const [sel, setSel] = useState<number | null>(null);
  if (!rows.length) return <Empty />;
  const W = 320, H = 140, mT = 10, mB = 20, mL = 4, mR = 4;
  const iw = W - mL - mR, ih = H - mT - mB;
  const max = Math.max(...rows.flatMap((r) => [r.newUsers, r.visits]), 1);
  const slot = iw / rows.length;
  const barW = Math.min(26, slot * 0.52);
  const y = (v: number) => mT + ih - (v / max) * ih;
  const cx = (i: number) => mL + slot * i + slot / 2;
  const path = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${y(r.visits).toFixed(1)}`).join(' ');
  const shown = sel !== null ? rows[sel] : rows[rows.length - 1];
  const everyNth = Math.ceil(rows.length / 7);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}
        role="img" aria-label="Новые пользователи и визиты по дням">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={mL} x2={W - mR} y1={mT + ih * f} y2={mT + ih * f}
            stroke="rgba(108, 41, 18, 0.08)" strokeWidth={1} />
        ))}
        {rows.map((r, i) => (
          <rect key={r.day} x={cx(i) - barW / 2} y={y(r.newUsers)} width={barW}
            height={Math.max(1, mT + ih - y(r.newUsers))} rx={4}
            fill={sel === i ? ACCENT : 'rgba(244, 137, 36, 0.45)'} />
        ))}
        <path d={path} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {rows.map((r, i) => (
          <circle key={`d-${r.day}`} cx={cx(i)} cy={y(r.visits)} r={sel === i ? 4 : 2.5} fill={INK} />
        ))}
        {rows.map((r, i) => (
          i % everyNth === 0 || i === rows.length - 1
            ? (
              <text key={`t-${r.day}`} x={cx(i)} y={H - 6} textAnchor="middle"
                fontFamily={FONT} fontSize={9.5} fontWeight={600} fill={INK_SOFT}>
                {r.day.slice(8, 10)}.{r.day.slice(5, 7)}
              </text>
            )
            : null
        ))}
        {rows.map((r, i) => (
          <rect key={`h-${r.day}`} x={mL + slot * i} y={0} width={slot} height={H}
            fill="transparent" style={{ cursor: 'pointer' }}
            onPointerEnter={() => setSel(i)} onPointerDown={() => setSel(i)}
            onPointerLeave={() => setSel(null)} />
        ))}
      </svg>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8,
        fontFamily: FONT, fontSize: '11.5px', fontWeight: 600, color: INK,
      }}>
        <span style={{ color: INK_SOFT }}>
          {sel === null ? 'последний день' : 'выбрано'} {shown.day.slice(8, 10)}.{shown.day.slice(5, 7)}
        </span>
        <span><Dot color={ACCENT} /> новых {formatNumber(shown.newUsers)}</span>
        <span><Dot color={INK} /> визитов {formatNumber(shown.visits)}</span>
        <span style={{ color: INK_SOFT }}>подборов завершено {formatNumber(shown.done)}</span>
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: 2,
      background: color, marginRight: 5, verticalAlign: 'middle',
    }} />
  );
}

// Кольцо кухонь на обводке круга: одна дуга — один сегмент, без зависимостей.
function Donut({ rows }: { rows: Array<{ label: string; value: number }> }) {
  if (!rows.length) return <Empty />;
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const R = 54, SW = 18, C = 2 * Math.PI * R;
  const palette = [ACCENT, '#E8395A', '#6C2912', '#22C55E', '#8B5CF6', '#E5CDA5', '#0EA5E9'];
  let acc = 0;
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 140 140" width={128} height={128} role="img" aria-label="Кухни фактических выборов">
        <g transform="rotate(-90 70 70)">
          {rows.map((r, i) => {
            const frac = r.value / total;
            const el = (
              <circle key={r.label} cx={70} cy={70} r={R} fill="none"
                stroke={palette[i % palette.length]} strokeWidth={SW}
                strokeDasharray={`${(C * frac).toFixed(2)} ${C.toFixed(2)}`}
                strokeDashoffset={(-C * acc).toFixed(2)} />
            );
            acc += frac;
            return el;
          })}
        </g>
        <text x={70} y={66} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={22} fill={INK}>
          {formatNumber(total)}
        </text>
        <text x={70} y={82} textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize={10} fill={INK_SOFT}>
          выборов
        </text>
      </svg>
      <div style={{ flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{
            display: 'flex', alignItems: 'baseline', gap: 6,
            fontFamily: FONT, fontSize: '12px', fontWeight: 600, color: INK,
          }}>
            <Dot color={palette[i % palette.length]} />
            <span style={{ flex: 1 }}>{r.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(r.value)}</span>
            <span style={{ color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber((r.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: Array<{ left: string; right: string; note?: string; source?: string }> }) {
  if (!rows.length) return <Empty />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((r, i) => (
        <div key={`${r.left}-${i}`} style={{
          display: 'flex', alignItems: 'baseline', gap: 10,
          padding: '9px 0', borderBottom: i < rows.length - 1 ? LINE : 'none',
          fontFamily: FONT, fontSize: '12.5px',
        }}>
          <span style={{ flex: 1, fontWeight: 600, color: INK, lineHeight: 1.35 }}>
            {r.left}
            {r.source && (
              <span style={{ display: 'block', fontWeight: 500, color: INK_SOFT, fontSize: '10.5px', marginTop: 2 }}>
                {r.source}
              </span>
            )}
          </span>
          <span style={{ fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {r.right}
          </span>
          {r.note && (
            <span style={{ fontWeight: 600, color: INK_SOFT, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {r.note}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const dishRows = (dishes: DishRow[], list: string) =>
  dishes.filter((d) => d.list === list).map((d) => ({
    label: d.dish, value: Number(d.n), hint: d.cuisine !== '—' ? d.cuisine : 'нет в таблице блюд',
  }));

const audienceRows = (audience: AudienceRow[], dimension: string) =>
  audience.filter((a) => a.dimension === dimension).map((a) => ({ label: a.label, value: Number(a.count) }));

// ─── Экран ────────────────────────────────────────────────────────────────────

export function StatsDashboard({ onBack }: { onBack(): void }) {
  const [period, setPeriod] = useState<StatsPeriod>('7d');
  // По умолчанию показываем всё, включая мой аккаунт: сначала полная картина, а отделить
  // свою активность — один тап по галочке ниже.
  const [excludeSelf, setExcludeSelf] = useState(false);
  const [data, setData] = useState<StatsPayload | null>(() => cachedStats('7d', false));
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(data ? 'ok' : 'loading');
  const [reason, setReason] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    const hit = cachedStats(period, excludeSelf);
    if (hit && nonce === 0) { setData(hit); setState('ok'); return; }
    setState('loading');
    void fetchStats(period, excludeSelf, { force: nonce > 0 }).then((res) => {
      if (!alive) return;
      if (res.ok) { setData(res.data); setState('ok'); setReason(null); }
      else { setState('error'); setReason(res.reason); }
    });
    return () => { alive = false; };
  }, [period, excludeSelf, nonce]);

  const funnel = useMemo(() => {
    const rows = data?.funnel ?? [];
    if (!rows.length) return [];
    const top = Number(rows[0].visits) || 1;
    let worst = -1, worstDrop = -1;
    for (let i = 1; i < rows.length; i++) {
      const d = Number(rows[i - 1].visits) - Number(rows[i].visits);
      if (d > worstDrop) { worstDrop = d; worst = i; }
    }
    return rows.map((r, i) => ({
      label: r.stage, value: Number(r.visits),
      hint: `${formatNumber((Number(r.visits) / top) * 100)}%`,
      danger: i === worst,
    }));
  }, [data]);

  const errorText = reason === 'no_telegram'
    ? 'Статистика открывается только внутри Telegram: вне него нет подписи initData, которую проверяет сервер.'
    : reason === 'forbidden'
      ? 'Сервер не признал этот аккаунт владельцем. Проверь секрет ADMIN_TG_IDS в проекте Supabase.'
      : reason === 'server'
        ? 'Сервер ответил ошибкой. Если SQL-файл 014_admin_stats.sql ещё не применён, агрегатов в базе пока нет.'
        : 'Не удалось получить данные. Похоже на проблему с сетью.';

  return (
    <>
      <div style={{
        padding: `clamp(20px, 4dvh, 32px) ${PAD} 0`, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <button type="button" onClick={onBack} aria-label="Назад в профиль"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            flexShrink: 0, fontFamily: FONT, fontSize: '20px', color: INK, lineHeight: 1,
          }}>
          ←
        </button>
        <h2 style={{
          fontFamily: FONT, fontWeight: 900, color: INK,
          fontSize: 'clamp(20px, 5.5vw, 28px)', letterSpacing: '-0.02em', flex: 1, margin: 0,
        }}>
          Статистика
        </h2>
        <button type="button" onClick={() => setNonce((n) => n + 1)} aria-label="Обновить"
          style={{
            background: 'none', border: LINE, borderRadius: 999, cursor: 'pointer',
            padding: '5px 11px', fontFamily: FONT, fontWeight: 700, fontSize: '11.5px', color: INK,
          }}>
          Обновить
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: `12px ${PAD} calc(24px + env(safe-area-inset-bottom, 0px))` }}>
        {/* Переключатель периода */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 10 }}>
          {PERIOD_LABELS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
              style={{
                flexShrink: 0, cursor: 'pointer', borderRadius: 999,
                padding: '7px 13px', fontFamily: FONT, fontWeight: 700, fontSize: '12.5px',
                border: period === p.id ? `1px solid ${ACCENT}` : LINE,
                background: period === p.id ? ACCENT : 'transparent',
                color: period === p.id ? '#fff' : INK,
                transition: 'background 0.18s ease, color 0.18s ease',
              }}>
              {p.label}
            </button>
          ))}
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          fontFamily: FONT, fontWeight: 600, fontSize: '12px', color: INK_SOFT, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={excludeSelf} onChange={(e) => setExcludeSelf(e.target.checked)}
            style={{ accentColor: ACCENT, width: 15, height: 15 }} />
          не считать мой аккаунт
        </label>

        {state === 'error' && (
          <div style={{ ...card, borderColor: 'rgba(239, 68, 68, 0.35)' }}>
            <p style={{ ...cardTitle, color: BAD }}>Не вышло</p>
            <p style={{ ...cardNote, margin: '6px 0 0' }}>{errorText}</p>
          </div>
        )}

        {state === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ ...card, padding: '12px 14px' }}>
                  <Skeleton height={10} width="60%" />
                  <div style={{ height: 8 }} />
                  <Skeleton height={22} width="45%" />
                </div>
              ))}
            </div>
            <div style={card}><Skeleton height={10} width="40%" /><div style={{ height: 12 }} /><Skeleton height={140} /></div>
            <div style={card}><Skeleton height={10} width="35%" /><div style={{ height: 12 }} /><Skeleton height={90} /></div>
          </div>
        )}

        {state === 'ok' && data && (
          <>
            {data.meta.failed.length > 0 && (
              <div style={{ ...card, borderColor: 'rgba(239, 68, 68, 0.35)', marginBottom: 12 }}>
                <p style={{ ...cardTitle, color: BAD, fontSize: '13px' }}>Часть агрегатов не посчиталась</p>
                <p style={{ ...cardNote, margin: '6px 0 0' }}>
                  Не ответили: {data.meta.failed.join(', ')}. Обычно это значит, что
                  scripts/sql/014_admin_stats.sql ещё не применён целиком.
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <Tile label="Всего пользователей" value={formatNumber(kpiValue(data.kpi, 'users_total'))} />
              <Tile label="Новых за период" value={formatNumber(kpiValue(data.kpi, 'users_new'))}
                trend={delta(data.kpi, data.kpiPrev, 'users_new')} />
              <Tile label="DAU" value={formatNumber(kpiValue(data.kpi, 'dau'))} />
              <Tile label="WAU" value={formatNumber(kpiValue(data.kpi, 'wau'))} />
              <Tile label="Подборов начато" value={formatNumber(kpiValue(data.kpi, 'quizzes_started'))}
                trend={delta(data.kpi, data.kpiPrev, 'quizzes_started')} />
              <Tile label="Подборов завершено" value={formatNumber(kpiValue(data.kpi, 'quizzes_completed'))}
                trend={delta(data.kpi, data.kpiPrev, 'quizzes_completed')} />
              <Tile label="Доходят до результата" value={formatNumber(kpiValue(data.kpi, 'completion_pct'))} unit="%"
                trend={delta(data.kpi, data.kpiPrev, 'completion_pct')} />
              <Tile label="Длительность подбора" value={formatNumber(kpiValue(data.kpi, 'quiz_seconds'))} unit="с" />
              <Tile label="Выборов блюд" value={formatNumber(kpiValue(data.kpi, 'dish_choices'))}
                trend={delta(data.kpi, data.kpiPrev, 'dish_choices')} />
              <Tile label="Брошено подборов" value={formatNumber(kpiValue(data.kpi, 'abandoned'))} />
            </div>

            <h3 style={sectionTitle}>Рост</h3>
            <div style={card}>
              <p style={cardTitle}>Новые пользователи и визиты</p>
              <p style={cardNote}>
                Столбцы — новые профили, линия — визиты. Сутки по Ташкенту. Коснись дня, чтобы увидеть числа.
              </p>
              <GrowthChart rows={(data.daily ?? []).map((d) => ({
                day: String(d.day).slice(0, 10),
                newUsers: Number(d.new_users), visits: Number(d.visits), done: Number(d.quizzes_completed),
              }))} />
            </div>

            <div style={{ ...card, marginTop: 10 }}>
              <p style={cardTitle}>Возврат</p>
              <p style={cardNote}>
                Главный вопрос продукта: открыли один раз или вернулись. D7 и D30 появятся,
                только когда базе хватит возраста — выдумывать их нельзя.
              </p>
              <Rows rows={(data.retention ?? []).map((r) => ({
                left: r.metric, source: r.note,
                right: `${formatNumber(Number(r.users))} из ${formatNumber(Number(r.base))}`,
                note: `${formatNumber(Number(r.pct))}%`,
              }))} />
            </div>

            <div style={{ ...card, marginTop: 10 }}>
              <p style={cardTitle}>Сколько раз заходил один человек</p>
              <p style={cardNote}>Визитов на пользователя за период.</p>
              <HBars accentFirst={false} rows={(data.visits ?? []).map((v) => ({
                label: v.bucket === '4+' ? '4 и больше визитов' : `${v.bucket} визит(а)`,
                value: Number(v.users),
              }))} />
            </div>

            <h3 style={sectionTitle}>Воронка</h3>
            <div style={card}>
              <p style={cardTitle}>Где теряются визиты</p>
              <p style={cardNote}>
                Самая большая потеря выделена красным. Четыре шага, а не пять: выбор блюда
                бывает и в Дуэли, и в рандомайзере, поэтому подмножеством результата он не является.
              </p>
              <HBars rows={funnel} accentFirst={false} />
            </div>

            <div style={{ ...card, marginTop: 10 }}>
              <p style={cardTitle}>На каких вопросах бросают</p>
              <p style={cardNote}>
                Считается на сервере: показан вопрос, результата нет, и сессия остыла больше
                30 минут назад. Событие test_abandoned для этого не годится — оно почти всегда
                теряется при закрытии вебвью.
              </p>
              <HBars accentFirst={false} rows={(data.dropoff ?? []).map((d, i) => ({
                label: d.question, value: Number(d.abandoned),
                hint: `шаг ${d.step}`, danger: i === 0,
              }))} />
            </div>

            <h3 style={sectionTitle}>Блюда</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={card}>
                <p style={cardTitle}>Что выбирают</p>
                <p style={cardNote}>Фактические выборы из истории — доведено до «беру это».</p>
                <HBars rows={dishRows(data.dishes ?? [], 'Выбрали')} />
              </div>
              <div style={card}>
                <p style={cardTitle}>Что чаще рекомендует алгоритм</p>
                <p style={cardNote}>Первое блюдо на экране результата.</p>
                <HBars rows={dishRows(data.dishes ?? [], 'Рекомендовали')} />
              </div>
              <div style={card}>
                <p style={cardTitle}>Победы в Дуэли</p>
                <p style={cardNote}>Каждый выбор в «Или / Или», не только финальный.</p>
                <HBars rows={dishRows(data.dishes ?? [], 'Победы в Battle')} />
              </div>
              <div style={card}>
                <p style={cardTitle}>Что отклоняют</p>
                <p style={cardNote}>Нажали «не хочу это» на рекомендации.</p>
                <HBars rows={dishRows(data.dishes ?? [], 'Отклонили')} />
              </div>
              <div style={card}>
                <p style={cardTitle}>Кухни</p>
                <p style={cardNote}>Все фактические выборы, сгруппированные по кухне блюда.</p>
                <Donut rows={(data.cuisines ?? []).map((c) => ({ label: c.cuisine, value: Number(c.chosen) }))} />
              </div>
            </div>

            <h3 style={sectionTitle}>Качество алгоритма</h3>
            <div style={card}>
              <p style={cardTitle}>Показатели подбора</p>
              <p style={cardNote}>
                Под каждым показателем — таблица и поле, откуда он взят. n — на скольких событиях посчитано.
              </p>
              <Rows rows={(data.quality ?? []).map((q) => ({
                left: q.metric, source: q.source,
                right: `${formatNumber(Number(q.value))} ${q.unit}`,
                note: `n=${formatNumber(Number(q.n))}`,
              }))} />
            </div>

            <h3 style={sectionTitle}>Откуда приходят</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={card}>
                <p style={cardTitle}>Источник визита</p>
                <p style={cardNote}>
                  Берётся из визитов, а не из профиля: в users.source start_param не переносится,
                  поэтому там он пуст у всех.
                </p>
                <HBars rows={audienceRows(data.audience ?? [], 'Источник визита')} />
              </div>
              <div style={card}>
                <p style={cardTitle}>Платформа</p>
                <p style={cardNote}>Клиент Telegram, из которого открыли.</p>
                <HBars rows={audienceRows(data.audience ?? [], 'Платформа')} />
              </div>
              <div style={card}>
                <p style={cardTitle}>Язык интерфейса</p>
                <p style={cardNote}>Из профилей, созданных за период.</p>
                <HBars rows={audienceRows(data.audience ?? [], 'Язык интерфейса')} />
              </div>
              <div style={card}>
                <p style={cardTitle}>Версии алгоритма</p>
                <p style={cardNote}>Сколько событий записано каждой версией подбора.</p>
                <HBars rows={audienceRows(data.audience ?? [], 'Версия алгоритма')} />
              </div>
            </div>

            <div style={{ ...card, marginTop: 10, background: 'transparent', border: 'none', padding: `10px 0 0` }}>
              <p style={{ ...cardNote, margin: 0 }}>
                Напоминания: {formatNumber(kpiValue(data.kpi, 'reminder_subs_optin'))} согласились
                из {formatNumber(kpiValue(data.kpi, 'reminder_subs_total'))} записанных.
                {' '}Период {new Date(data.meta.from).toLocaleDateString('ru-RU')} — {new Date(data.meta.to).toLocaleDateString('ru-RU')},
                {' '}часовой пояс {data.meta.timezone}.
                {' '}Данные на {new Date(data.meta.generatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.
                {kpi(data.kpi, 'users_total') && ` Источник «Всего пользователей» — ${kpi(data.kpi, 'users_total')!.source}.`}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
