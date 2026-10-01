export type Lang = 'ru' | 'uz';

const ru = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  nav_home:    'Главная',
  nav_history: 'История',
  nav_battle:  'Или / Или',
  nav_profile: 'Профиль',

  // ── App loading / error (initial dish fetch) ──────────────────────────────────
  app_loading_text:    'Загружаем меню…',
  app_error_title:     'Не удалось загрузить',
  app_error_subtitle:  'Проверьте соединение и попробуйте снова',
  app_error_retry:     'Повторить',

  // ── Start screen ────────────────────────────────────────────────────────────
  // Question count is adaptive per session (see src/logic/engine.ts) — no exact number here
  start_tagline: 'Найди что поесть за пару вопросов',
  btn_randomizer: 'Рандомайзер',
  btn_start:      'Начать!',
  start_hint:     'Пара карточек · ИИ подберёт блюдо',

  // ── Mode selection ───────────────────────────────────────────────────────────
  mode_title: 'Что хочется?',

  // ── Cuisine selection ────────────────────────────────────────────────────────
  btn_random_cuisine: 'Любая кухня',

  // ── Answer buttons ───────────────────────────────────────────────────────────
  answer_no:  'Нет',
  answer_any: 'Без разницы',
  answer_yes: 'Да',

  // ── Quiz progress ────────────────────────────────────────────────────────────
  quiz_question_n: 'Вопрос {n}',
  quiz_remaining:  '≈ ещё {k}',
  quiz_last:       'Последний вопрос',
  quiz_searching:  'Будем искать!',


  // ── Loading screen ───────────────────────────────────────────────────────────
  loading_title:    'Подбираем\nдля тебя',
  loading_subtitle: 'ИИ анализирует твои вкусы',

  // ── Single result ────────────────────────────────────────────────────────────
  result_match_label: 'Подходит на',
  result_no_exact:    'Точного совпадения нет',
  tab_all_cuisines:   'Все кухни',
  btn_nearby:         'Что рядом?',
  btn_retry:          'Пройти заново',
  btn_all_results:    'Все варианты',
  btn_back:           'Назад',

  // ── Results list ─────────────────────────────────────────────────────────────
  results_title:       'Тебе подойдёт',
  results_subtitle:    'ИИ подобрал по твоим свайпам',
  results_match_label: 'Подходит на',
  btn_nearby_list:     'Что есть рядом?',
  btn_view_history:    'Посмотреть историю',
  tab_this_cuisine:    'Эта кухня',

  // ── History ──────────────────────────────────────────────────────────────────
  history_title:          'Прошлые поиски',
  history_empty_title:    'Здесь появятся\nтвои прошлые поиски',
  history_empty_subtitle: 'Пройди квиз и сохрани любимое блюдо',
  history_mode_meal:    'Плотно поесть',
  history_mode_snack:   'Перекус',
  history_mode_dessert: 'Сладкое',
  history_mode_random:  'Рандомайзер',
  history_mode_battle:  'Или / Или',

  // ── Map ──────────────────────────────────────────────────────────────────────
  map_title:    'Заведения',
  places_empty_title:    'Что близко?',
  places_empty_subtitle: 'Эта функция в процессе разработки!',

  // ── Nearby («Что рядом?») ─────────────────────────────────────────────────────
  nearby_title:          'Где поесть',
  nearby_empty_title:    'Пока не знаем, где подают это блюдо',
  nearby_empty_subtitle: 'Мы добавляем заведения — загляни чуть позже',
  price_currency:        'сум',
  btn_express24:         'Express24',
  btn_yandex_eda:        'Яндекс Еда',
  btn_open_dish:         'Открыть',

  // ── Profile ──────────────────────────────────────────────────────────────────
  profile_title:      'Профиль',
  profile_guest_name: 'Гость',
  profile_diet:   'Диетические ограничения',
  profile_lang:   'Язык',
  profile_notify: 'Уведомления',
  profile_share:  'Поделиться результатом',
  profile_clear_history: 'Очистить историю',
  clear_history_confirm_title:    'Очистить всю историю?',
  clear_history_confirm_subtitle: 'Это действие нельзя отменить — все блюда, что попадались раньше, исчезнут из списка.',
  btn_clear_history:  'Очистить',
  history_cleared_toast: 'История очищена',

  // ── Diet options ─────────────────────────────────────────────────────────────
  diet_gluten:  'Глютен',
  diet_lactose: 'Лактоза',
  diet_nuts:    'Орехи',
  diet_seafood: 'Морепродукты',
  diet_eggs:    'Яйца',

  // ── No results ───────────────────────────────────────────────────────────────
  no_results_title:    'Под твои ограничения ничего не нашлось',
  no_results_subtitle: 'Попробуй другой режим или кухню, либо измени ограничения в профиле',
  btn_try_other:       'Выбрать заново',

  // ── Или / Или ────────────────────────────────────────────────────────────────
  battle_title:        'ИЛИ / ИЛИ',
  battle_subtitle:     'Не знаешь, чего хочется?\nВыбирай между двумя блюдами —\nмы найдём победителя на сегодня',
  battle_start:        'Начать',
  battle_hint:         '6 быстрых выборов',
  battle_question:     'Что бы ты выбрал прямо сейчас?',
  battle_or:           'или',
  battle_final:        'Финал',
  battle_result_title: 'Твой выбор на сегодня',
  battle_wins:         'побед из',
  battle_again:        'Сыграть ещё раз',
  battle_home:         'На главную',
  battle_empty_title:  'Пока не из чего выбирать',
  battle_empty_sub:    'Ограничения в профиле убрали почти все блюда',

  // ── Common ───────────────────────────────────────────────────────────────────
  btn_apply:    'Применить',
  toast_copied: 'Ссылка скопирована',
  toast_soon:   'Скоро',
  share_text:   'Нашёл что поесть в OMNOM!',
} as const;

const uz: Record<keyof typeof ru, string> = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  nav_home:    'Bosh sahifa',
  nav_history: 'Tarix',
  nav_battle:  'Yoki / Yoki',
  nav_profile: 'Profil',

  // ── App loading / error (initial dish fetch) ──────────────────────────────────
  app_loading_text:    'Menyu yuklanmoqda…',
  app_error_title:     "Yuklab bo'lmadi",
  app_error_subtitle:  "Ulanishni tekshirib, qayta urinib ko'ring",
  app_error_retry:     "Qayta urinish",

  // ── Start screen ────────────────────────────────────────────────────────────
  start_tagline: 'Bir nechta savol bilan nima yeyishni top',
  btn_randomizer: 'Tasodifiy',
  btn_start:      'Boshlash!',
  start_hint:     "Bir nechta karta · AI taom tanlaydi",

  // ── Mode selection ───────────────────────────────────────────────────────────
  mode_title: 'Nima xohlaysiz?',

  // ── Cuisine selection ────────────────────────────────────────────────────────
  btn_random_cuisine: 'Istalgan oshxona',

  // ── Answer buttons ───────────────────────────────────────────────────────────
  answer_no:  "Yo'q",
  answer_any: 'Farq qilmaydi',
  answer_yes: 'Ha',

  // ── Quiz progress ────────────────────────────────────────────────────────────
  quiz_question_n: '{n}-savol',
  quiz_remaining:  '≈ yana {k}',
  quiz_last:       'Oxirgi savol',
  quiz_searching:  'Qidiramiz!',


  // ── Loading screen ───────────────────────────────────────────────────────────
  loading_title:    'Siz uchun\ntanlamoqdamiz',
  loading_subtitle: "AI did'ingizni tahlil qilmoqda",

  // ── Single result ────────────────────────────────────────────────────────────
  result_match_label: 'Moslik',
  result_no_exact:    'Aniq moslik topilmadi',
  tab_all_cuisines:   'Barcha oshxonalar',
  btn_nearby:         'Yaqinda nima bor?',
  btn_retry:          'Qayta boshlash',
  btn_all_results:    'Barcha variantlar',
  btn_back:           'Orqaga',

  // ── Results list ─────────────────────────────────────────────────────────────
  results_title:       'Siz uchun mos',
  results_subtitle:    'AI swipe asosida tanladi',
  results_match_label: 'Moslik',
  btn_nearby_list:     'Yaqinda nima bor?',
  btn_view_history:    'Tarixni ko‘rish',
  tab_this_cuisine:    'Shu oshxona',

  // ── History ──────────────────────────────────────────────────────────────────
  history_title:          "O'tgan izlashlar",
  history_empty_title:    "Bu yerda o'tgan\nizlashlaringiz ko'rinadi",
  history_empty_subtitle: "Viktorinani o'tab, sevimli taomingizni saqlang",
  history_mode_meal:    'To‘yib ovqatlanish',
  history_mode_snack:   'Tamaddi',
  history_mode_dessert: 'Shirinlik',
  history_mode_random:  'Tasodifiy',
  history_mode_battle:  'Yoki / Yoki',

  // ── Map ──────────────────────────────────────────────────────────────────────
  map_title:    'Muassasalar',
  places_empty_title:    'Nima yaqin?',
  places_empty_subtitle: 'Bu funksiya ishlab chiqilmoqda!',

  // ── Nearby («Что рядом?») ─────────────────────────────────────────────────────
  nearby_title:          'Qayerda yeyish mumkin',
  nearby_empty_title:    'Bu taom qayerda tortilishini hozircha bilmaymiz',
  nearby_empty_subtitle: 'Muassasalarni qo‘shyapmiz — birozdan so‘ng qayta kiring',
  price_currency:        'so‘m',
  btn_express24:         'Express24',
  btn_yandex_eda:        'Yandex Eda',
  btn_open_dish:         'Ochish',

  // ── Profile ──────────────────────────────────────────────────────────────────
  profile_title:      'Profil',
  profile_guest_name: 'Mehmon',
  profile_diet:   'Parhez cheklovlari',
  profile_lang:   'Til',
  profile_notify: 'Bildirishnomalar',
  profile_share:  'Natijani ulashish',
  profile_clear_history: 'Tarixni tozalash',
  clear_history_confirm_title:    "Butun tarixni tozalashni xohlaysizmi?",
  clear_history_confirm_subtitle: "Bu amalni bekor qilib bo'lmaydi — oldin ko'rgan barcha taomlar ro'yxatdan yo'qoladi.",
  btn_clear_history:  'Tozalash',
  history_cleared_toast: 'Tarix tozalandi',

  // ── Diet options ─────────────────────────────────────────────────────────────
  diet_gluten:  'Gluten',
  diet_lactose: 'Laktoza',
  diet_nuts:    "Yong'oqlar",
  diet_seafood: 'Dengiz mahsulotlari',
  diet_eggs:    'Tuxum',

  // ── No results ───────────────────────────────────────────────────────────────
  no_results_title:    "Cheklovlaringizga mos hech narsa topilmadi",
  no_results_subtitle: "Boshqa rejim yoki oshxonani tanlang yoxud profildan cheklovlarni o'zgartiring",
  btn_try_other:       "Qaytadan tanlash",

  // ── Yoki / Yoki ──────────────────────────────────────────────────────────────
  battle_title:        'YOKI / YOKI',
  battle_subtitle:     "Nima xohlayotganingizni bilmaysizmi?\nIkki taomdan birini tanlang —\nbugungi g'olibni biz topamiz",
  battle_start:        'Boshlash',
  battle_hint:         '6 ta tezkor tanlov',
  battle_question:     'Hozir qaysi birini tanlardingiz?',
  battle_or:           'yoki',
  battle_final:        'Final',
  battle_result_title: 'Bugungi tanlovingiz',
  battle_wins:         "g'alaba,",
  battle_again:        "Yana o'ynash",
  battle_home:         'Bosh sahifaga',
  battle_empty_title:  'Hozircha tanlash uchun taom yo‘q',
  battle_empty_sub:    'Profildagi cheklovlar deyarli barcha taomlarni olib tashladi',

  // ── Common ───────────────────────────────────────────────────────────────────
  btn_apply:    "Qo'llash",
  toast_copied: 'Havola nusxalandi',
  toast_soon:   'Tez orada',
  share_text:   'OMNOM da nima yeyishni topdim!',
};

export const translations: Record<Lang, Record<keyof typeof ru, string>> = { ru, uz };
export type TranslationKey = keyof typeof ru;
