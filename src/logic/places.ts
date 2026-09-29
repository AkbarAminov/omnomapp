export type Place = {
  id: string;
  name: string;
  district: string;
  address: string;
  lat: number | null;
  lng: number | null;
  express24_url: string;
  yandex_eda_url: string;
  is_active: boolean;
};

export type MenuItem = { id: string; place_id: string; dish_id: string; price: number | null; url: string };

export type PlaceOffer = { place: Place; price: number | null; url: string };

const str = (v: unknown) => (v == null ? '' : String(v).trim());
const numOrNull = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function normalizePlace(raw: Record<string, unknown>): Place {
  return {
    id: str(raw.id),
    name: str(raw.name),
    district: str(raw.district),
    address: str(raw.address),
    lat: numOrNull(raw.lat),
    lng: numOrNull(raw.lng),
    express24_url: str(raw.express24_url),
    yandex_eda_url: str(raw.yandex_eda_url),
    is_active: raw.is_active !== false && str(raw.is_active).toLowerCase() !== 'false',
  };
}

export function normalizeMenuItem(raw: Record<string, unknown>): MenuItem {
  return { id: str(raw.id), place_id: str(raw.place_id), dish_id: str(raw.dish_id), price: numOrNull(raw.price), url: str(raw.url) };
}

// Active places serving the dish, cheapest first (unknown price last).
export function offersForDish(dishId: string, menuItems: readonly MenuItem[], places: readonly Place[]): PlaceOffer[] {
  const byId = new Map(places.filter((p) => p.is_active).map((p) => [p.id, p]));
  return menuItems
    .filter((m) => m.dish_id === dishId && byId.has(m.place_id))
    .map((m) => ({ place: byId.get(m.place_id)!, price: m.price, url: m.url }))
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.place.name.localeCompare(b.place.name));
}

export function isSafeUrl(url: string): boolean {
  return /^https:\/\//i.test(url);
}
