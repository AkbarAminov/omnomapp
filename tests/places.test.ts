import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeUrl, normalizeMenuItem, normalizePlace, offersForDish } from '../src/logic/places.ts';
import { loadDishes, loadRawCsv } from '../scripts/lib/csvData.ts';

const place = (id: string, extra: Record<string, unknown> = {}) => normalizePlace({ id, name: id, is_active: true, ...extra });
const item = (id: string, place_id: string, dish_id: string, price: unknown) => normalizeMenuItem({ id, place_id, dish_id, price });

test('offersForDish: only active places serving the dish, cheapest first, unknown price last', () => {
  const places = [place('a'), place('b'), place('c', { is_active: false }), place('d')];
  const items = [
    item('1', 'a', 'plov', 50000),
    item('2', 'b', 'plov', 42000),
    item('3', 'c', 'plov', 10000),
    item('4', 'd', 'plov', ''),
    item('5', 'a', 'lagman', 30000),
    item('6', 'zzz', 'plov', 1),
  ];
  assert.deepEqual(offersForDish('plov', items, places).map((o) => [o.place.id, o.price]), [['b', 42000], ['a', 50000], ['d', null]]);
  assert.deepEqual(offersForDish('manti', items, places), []);
});

test('normalizePlace parses is_active from boolean and CSV text; coordinates become numbers', () => {
  assert.equal(normalizePlace({ id: 'x', is_active: false }).is_active, false);
  assert.equal(normalizePlace({ id: 'x', is_active: 'false' }).is_active, false);
  assert.equal(normalizePlace({ id: 'x', is_active: 'true' }).is_active, true);
  assert.equal(normalizePlace({ id: 'x', lat: '41.3', lng: '' }).lat, 41.3);
  assert.equal(normalizePlace({ id: 'x', lat: '41.3', lng: '' }).lng, null);
});

test('isSafeUrl accepts only https links', () => {
  assert.equal(isSafeUrl('https://express24.uz/x'), true);
  assert.equal(isSafeUrl('http://example.com'), false);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(isSafeUrl(''), false);
});

test('places/menu_items CSV templates parse and reference real dishes', () => {
  const places = loadRawCsv('places.csv');
  const items = loadRawCsv('menu_items.csv');
  const dishIds = new Set(loadDishes().map((d) => d.id));
  const placeIds = new Set(places.map((p) => p.id));
  assert.ok(places.length >= 1);
  for (const m of items) {
    assert.ok(placeIds.has(m.place_id), `${m.id}: place ${m.place_id}`);
    assert.ok(dishIds.has(m.dish_id), `${m.id}: dish ${m.dish_id}`);
  }
});
