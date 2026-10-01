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
  quiz_searching:  'Будем искать!',
  quiz_almost:     'Уже близко',
  quiz_last_one:   'Последний вопрос',


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
  profile_share:  'Рассказать о приложении',
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
  battle_tutorial_title: 'Выбирай, что хочется больше',
  battle_tutorial_sub:   'Оставляй фаворита — мы будем подбирать ему новых соперников. А если блюдо не хочется совсем, смахни его влево.',
  battle_tutorial_cta:   'Понятно',
  battle_question:     'Что хочется сейчас?',
  battle_or:           'или',
  battle_reject:       'сегодня нет',
  battle_final:        'Финал',
  battle_result_title: 'Твой выбор на сегодня',
  battle_wins:         'побед из',
  battle_beat:         'Обошёл:',
  battle_beat_more:    'и ещё',
  battle_similar:      'Похоже на твой выбор',
  battle_again:        'Сыграть ещё раз',
  btn_share_result:    'Поделиться',
  share_card_caption:  'Мой выбор на сегодня',
  toast_share_saved:   'Картинка сохранена',
  toast_share_failed:  'Не получилось поделиться',
  battle_empty_title:  'Пока не из чего выбирать',
  battle_empty_sub:    'Ограничения в профиле убрали почти все блюда',

  // ── Common ───────────────────────────────────────────────────────────────────
  btn_apply:    'Применить',
  btn_close:    'Закрыть',
  btn_cancel:   'Отмена',
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
  quiz_searching:  'Qidiramiz!',
  quiz_almost:     'Deyarli tayyor',
  quiz_last_one:   'Oxirgi savol',


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
  profile_share:  'Ilova haqida aytish',
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
  battle_tutorial_title: 'Ko‘proq nimani xohlasangiz, shuni tanlang',
  battle_tutorial_sub:   "Sevimlisini qoldiring — unga yangi raqiblar topamiz. Taom umuman xohlanmasa, chapga suring.",
  battle_tutorial_cta:   'Tushunarli',
  battle_question:     'Hozir nima xohlaysiz?',
  battle_or:           'yoki',
  battle_reject:       'bugun emas',
  battle_final:        'Final',
  battle_result_title: 'Bugungi tanlovingiz',
  battle_wins:         "g'alaba,",
  battle_beat:         'Yutdi:',
  battle_beat_more:    'va yana',
  battle_similar:      'Tanlovingizga o‘xshash',
  battle_again:        "Yana o'ynash",
  btn_share_result:    'Ulashish',
  share_card_caption:  'Bugungi tanlovim',
  toast_share_saved:   'Rasm saqlandi',
  toast_share_failed:  "Ulashib bo'lmadi",
  battle_empty_title:  'Hozircha tanlash uchun taom yo‘q',
  battle_empty_sub:    'Profildagi cheklovlar deyarli barcha taomlarni olib tashladi',

  // ── Common ───────────────────────────────────────────────────────────────────
  btn_apply:    "Qo'llash",
  btn_close:    'Yopish',
  btn_cancel:   'Bekor qilish',
  toast_copied: 'Havola nusxalandi',
  toast_soon:   'Tez orada',
  share_text:   'OMNOM da nima yeyishni topdim!',
};

export const translations: Record<Lang, Record<keyof typeof ru, string>> = { ru, uz };
export type TranslationKey = keyof typeof ru;
