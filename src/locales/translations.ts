export type Lang = 'ru' | 'uz';

const ru = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  nav_home:    'Главная',
  nav_history: 'История',
  nav_map:     'Карта',
  nav_profile: 'Профиль',

  // ── Start screen ────────────────────────────────────────────────────────────
  start_tagline: 'Найди что поесть за 6 вопросов',
  btn_randomizer: 'Рандомайзер',
  btn_start:      'Начать!',
  start_hint:     '6 карточек · ИИ подберёт блюдо',

  // ── Cuisine selection ────────────────────────────────────────────────────────
  btn_random_cuisine: 'Рандомная кухня',

  // ── Answer buttons ───────────────────────────────────────────────────────────
  answer_no:  'Нет',
  answer_any: 'Без разницы',
  answer_yes: 'Да',

  // ── Loading screen ───────────────────────────────────────────────────────────
  loading_title:    'Подбираем\nдля тебя',
  loading_subtitle: 'ИИ анализирует твои вкусы',

  // ── Single result ────────────────────────────────────────────────────────────
  result_match_label: 'Подходит на',
  btn_nearby:         'Что рядом?',
  btn_retry:          'Пройти заново',
  btn_all_results:    'Все варианты',

  // ── Results list ─────────────────────────────────────────────────────────────
  results_title:       'Тебе подойдёт',
  results_subtitle:    'ИИ подобрал по твоим свайпам',
  results_match_label: 'Подходит на',
  btn_nearby_list:     'Что есть рядом?',

  // ── History ──────────────────────────────────────────────────────────────────
  history_title:          'Прошлые поиски',
  history_empty_title:    'Здесь появятся\nтвои прошлые поиски',
  history_empty_subtitle: 'Пройди квиз и сохрани любимое блюдо',

  // ── Map ──────────────────────────────────────────────────────────────────────
  map_title:    'Что близко?',
  map_subtitle: 'Эта функция в процессе разработки!',

  // ── Profile ──────────────────────────────────────────────────────────────────
  profile_title:  'Профиль',
  profile_diet:   'Диетические ограничения',
  profile_lang:   'Язык',
  profile_notify: 'Уведомления',
  profile_share:  'Поделиться результатом',

  // ── Diet options ─────────────────────────────────────────────────────────────
  diet_gluten:  'Глютен',
  diet_lactose: 'Лактоза',
  diet_nuts:    'Орехи',
  diet_seafood: 'Морепродукты',
  diet_eggs:    'Яйца',

  // ── No results ───────────────────────────────────────────────────────────────
  no_results_title:    'С твоими ограничениями в этой кухне ничего не нашлось',
  no_results_subtitle: 'Попробуй другую кухню или измени ограничения в профиле',
  btn_try_other:       'Выбрать другую кухню',

  // ── Common ───────────────────────────────────────────────────────────────────
  btn_apply:    'Применить',
  toast_copied: 'Ссылка скопирована',
  share_text:   'Нашёл что поесть в OMNOM!',
} as const;

const uz: Record<keyof typeof ru, string> = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  nav_home:    'Bosh sahifa',
  nav_history: 'Tarix',
  nav_map:     'Xarita',
  nav_profile: 'Profil',

  // ── Start screen ────────────────────────────────────────────────────────────
  start_tagline: '6 savol bilan nima yeyishni top',
  btn_randomizer: 'Tasodifiy',
  btn_start:      'Boshlash!',
  start_hint:     '6 karta · AI taom tanlaydi',

  // ── Cuisine selection ────────────────────────────────────────────────────────
  btn_random_cuisine: 'Tasodifiy oshxona',

  // ── Answer buttons ───────────────────────────────────────────────────────────
  answer_no:  "Yo'q",
  answer_any: 'Farq qilmaydi',
  answer_yes: 'Ha',

  // ── Loading screen ───────────────────────────────────────────────────────────
  loading_title:    'Siz uchun\ntanlamoqdamiz',
  loading_subtitle: "AI did'ingizni tahlil qilmoqda",

  // ── Single result ────────────────────────────────────────────────────────────
  result_match_label: 'Moslik',
  btn_nearby:         'Yaqinda nima bor?',
  btn_retry:          'Qayta boshlash',
  btn_all_results:    'Barcha variantlar',

  // ── Results list ─────────────────────────────────────────────────────────────
  results_title:       'Siz uchun mos',
  results_subtitle:    'AI swipe asosida tanladi',
  results_match_label: 'Moslik',
  btn_nearby_list:     'Yaqinda nima bor?',

  // ── History ──────────────────────────────────────────────────────────────────
  history_title:          "O'tgan izlashlar",
  history_empty_title:    "Bu yerda o'tgan\nizlashlaringiz ko'rinadi",
  history_empty_subtitle: "Viktorinani o'tab, sevimli taomingizni saqlang",

  // ── Map ──────────────────────────────────────────────────────────────────────
  map_title:    'Nima yaqin?',
  map_subtitle: 'Bu funksiya ishlab chiqilmoqda!',

  // ── Profile ──────────────────────────────────────────────────────────────────
  profile_title:  'Profil',
  profile_diet:   'Parhez cheklovlari',
  profile_lang:   'Til',
  profile_notify: 'Bildirishnomalar',
  profile_share:  'Natijani ulashish',

  // ── Diet options ─────────────────────────────────────────────────────────────
  diet_gluten:  'Gluten',
  diet_lactose: 'Laktoza',
  diet_nuts:    "Yong'oqlar",
  diet_seafood: 'Dengiz mahsulotlari',
  diet_eggs:    'Tuxum',

  // ── No results ───────────────────────────────────────────────────────────────
  no_results_title:    "Cheklovlaringiz bilan bu oshxonada hech narsa topilmadi",
  no_results_subtitle: "Boshqa oshxonani sinab ko'ring yoki profildan cheklovlarni o'zgartiring",
  btn_try_other:       "Boshqa oshxona tanlash",

  // ── Common ───────────────────────────────────────────────────────────────────
  btn_apply:    "Qo'llash",
  toast_copied: 'Havola nusxalandi',
  share_text:   'OMNOM da nima yeyishni topdim!',
};

export const translations: Record<Lang, Record<keyof typeof ru, string>> = { ru, uz };
export type TranslationKey = keyof typeof ru;
