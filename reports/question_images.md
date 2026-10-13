# Картинки для вопросов

Всего вопросов: **46**. С картинками уже **8** (переиспользуют `char-*.png`), без картинок — **38**.
Но среди этих 38 есть **9 пар с одинаковой сценой** (вопрос дублируется для «поесть» и «перекус»),
поэтому рисовать нужно **29 уникальных картинок**, а два файла с одинаковым содержимым просто
сохранить под разными именами.

## Как генерить

Модель — та же, что для блюд: **Nano Banana 2.1** (`gemini-nano-banana-2.1`) в AI Studio или в приложении Gemini.

**Главный приём: прикладывайте к запросу существующую картинку маскота** (`public/assets/char-meal.png`,
`char-soup.png`, `char-hot.png`) как референс и пишите «keep this exact character, same style».
Без референса модель каждый раз рисует чуть другого персонажа — разъедутся пропорции, оттенок и глаза.
Текстовый блок стиля ниже описывает маскота словами, но картинка-референс работает надёжнее.

**Формат.** Карточка показывает картинку через `object-fit: contain` на кремовом фоне `#FFF1DD`,
то есть **фон должен быть прозрачным**, иначе вокруг персонажа будет белый прямоугольник.
Существующие маскоты — PNG 1080×1200 с альфа-каналом. Генерируйте на белом фоне и срезайте его:

```bash
magick in.png -fuzz 12% -transparent white -trim +repage -resize 1080x1200 out.webp
```

WebP с прозрачностью весит ~100 КБ против 1.4 МБ у нынешних PNG — лучше сохранять в него.

**Куда класть:** `public/images/questions/<id>.webp`. Приложение подхватит файл само
(`localImage('questions', id)` в `scripts/lib/csvData.ts`), дальше `npm run gen:sql` и применить SQL.
Если решите хранить в Supabase storage, как фото блюд, — скажите, заливка делается тем же скриптом.

## Общий блок стиля

Вставляйте его перед каждой сценой без изменений:

```
Children's book style digital illustration of OmNom, a chubby mascot shaped like a plump golden
teardrop — a crispy fried nugget with a lightly breaded speckled amber-orange crust and a slightly
darker toasted rim. He has two large round white eyes with big black pupils, no eyebrows, a small
simple smiling mouth, short stubby arms with rounded four-finger hands, no neck and no legs.
Hand-painted airbrushed look, soft volumetric shading, fine crispy texture, warm golden palette.
SCENE: {сцена}.
Props painted in the same semi-realistic painterly style as the character. Single character,
full body, centered, portrait composition, isolated on a plain pure white background, soft contact
shadow under the body, no text, no logos, no frame, no border.
```

## Вопросы

Колонка «файл» — имя, под которым сохранять. Где указано «= id», это та же картинка, что у парного
вопроса: сохраните её дважды под обоими именами.

### Поесть (meal), 21 вопрос

| id | вопрос | файл | сцена для промпта |
|---|---|---|---|
| `q_m_heavy` | Сытное, чтобы наесться? | ✅ `char-meal.png` | уже есть |
| `q_m_soup` | Суп? | ✅ `char-soup.png` | уже есть |
| `q_m_meat` | С мясом? | ✅ `char-meat.png` | уже есть |
| `q_m_hot` | Горячее? | ✅ `char-hot.png` | уже есть |
| `q_m_fast` | По-быстрому? | ✅ `char-fast.png` | уже есть |
| `q_m_noodles` | Лапша или паста? | `q_m_noodles.webp` | twirling long noodles around a pair of chopsticks raised high, a steaming bowl of noodles held in his other hand |
| `q_m_rice` | На рисе? | `q_m_rice.webp` | holding a wide bowl piled high with fluffy steaming rice, a few grains on his hands |
| `q_m_dough` | На тесте? | `q_m_dough.webp` | holding a golden flaky triangular samsa pastry in both hands, crumbs falling |
| `q_m_fried` | С хрустящей корочкой? | `q_m_fried.webp` | holding a frying pan with golden crispy food sizzling in it, tiny sparks of oil |
| `q_m_grilled` | С гриля или мангала? | `q_m_grilled.webp` | standing at a small charcoal grill, holding a skewer of grilled meat, light smoke rising |
| `q_m_seafood` | Рыба или морепродукты? | `q_m_seafood.webp` | holding a fresh shiny silver fish in both hands, looking proud |
| `q_m_dumpling` | Пельмени или манты? | `q_m_dumpling.webp` | shaping a dumpling with his hands over a tray of manti, a light dusting of flour around |
| `q_m_spicy` | Острое? | `q_m_spicy.webp` | holding a bright red chili pepper, cheeks flushed, small puffs of steam coming out of his ears |
| `q_m_hands` | Руками, без приборов? | `q_m_hands.webp` | holding a big juicy burger with both hands, about to take a bite, no cutlery anywhere |
| `q_m_steamed` | На пару? | `q_m_steamed.webp` | standing in a soft cloud of steam over an open steamer basket full of manti |
| `q_m_cheese` | С сыром? | `q_m_cheese.webp` | pulling a slice of pizza away, long stretchy strings of melted cheese between slice and pie |
| `q_m_veggies` | Овощное? | `q_m_veggies.webp` | carrying a small wicker basket full of fresh colorful vegetables |
| `q_m_fatty` | Жирное и сочное? | `q_m_fatty.webp` | licking his lips over a rich juicy plate of food, eyes sparkling, tiny shine on his mouth |
| `q_m_sweet` | Сладкое? | `q_m_sweet.webp` | holding a small jar of berry jam with a spoon, a glossy drip running down the jar |
| `q_m_chicken` | С курицей? | `q_m_chicken.webp` | hugging a whole golden roasted chicken on a platter |
| `q_m_wrap` | В лаваше или тортилье? | `q_m_wrap.webp` | holding a thick shawarma wrap in both hands, foil peeled halfway down |

### Перекус (snack), 16 вопросов

| id | вопрос | файл | сцена для промпта |
|---|---|---|---|
| `q_s_heavy` | Сытное? | ✅ `char-meal.png` | уже есть |
| `q_s_hot` | Горячее? | ✅ `char-hot.png` | уже есть |
| `q_s_meat` | С мясом? | ✅ `char-meat.png` | уже есть |
| `q_s_asian` | Азиатское? | `q_s_asian.webp` | holding chopsticks with a sushi roll, a small plate of rolls and gyoza in front of him |
| `q_s_fastfood` | Фастфуд? | `q_s_fastfood.webp` | a burger in one hand and a paper cup of soda with a straw in the other |
| `q_s_east` | Восточное? | `q_s_east.webp` | holding a round flatbread, small bowls of mezze dips around him |
| `q_s_europe` | Европейское? | `q_s_europe.webp` | hugging a long crusty baguette almost as tall as he is |
| `q_s_fried` | С хрустящей корочкой? | = `q_m_fried` | та же картинка |
| `q_s_seafood` | Рыба или морепродукты? | = `q_m_seafood` | та же картинка |
| `q_s_dough` | Выпечка или лепёшка? | = `q_m_dough` | та же картинка |
| `q_s_cheese` | С сыром? | = `q_m_cheese` | та же картинка |
| `q_s_spicy` | Острое? | = `q_m_spicy` | та же картинка |
| `q_s_hands` | Руками, без приборов? | = `q_m_hands` | та же картинка |
| `q_s_veggies` | Овощное? | = `q_m_veggies` | та же картинка |
| `q_s_chicken` | С курицей? | = `q_m_chicken` | та же картинка |
| `q_s_wrap` | В лаваше или тортилье? | = `q_m_wrap` | та же картинка |

### Десерт (dessert), 9 вопросов

| id | вопрос | файл | сцена для промпта |
|---|---|---|---|
| `q_d_hot` | Тёплое? | `q_d_hot.webp` | holding a warm plate of thin pancakes, light steam rising from the stack |
| `q_d_east` | Восточные сладости? | `q_d_east.webp` | holding a tray of baklava pieces topped with chopped pistachios and glossy honey |
| `q_d_home` | Домашнее, как в детстве? | `q_d_home.webp` | wearing a small apron, proudly holding a homemade layered honey cake |
| `q_d_choc` | С шоколадом? | `q_d_choc.webp` | holding a big bar of dark chocolate with one square broken off |
| `q_d_creamy` | Нежное и кремовое? | `q_d_creamy.webp` | holding a slice of creamy layered cake on a small plate, a fork in his other hand |
| `q_d_fruity` | Фруктовое или ягодное? | `q_d_fruity.webp` | holding one big ripe strawberry in both hands, more berries scattered at his feet |
| `q_d_nuts` | С орехами? | `q_d_nuts.webp` | holding a handful of pistachios in cupped hands, a few nuts spilling |
| `q_d_frozen` | Холодное, как мороженое? | `q_d_frozen.webp` | holding an ice cream cone with two scoops, one tiny drip running down |
| `q_d_hands` | Руками, без приборов? | `q_d_hands.webp` | holding a small golden pirozhok pastry in both hands, taking a bite |

## На что обратить внимание

**`q_m_meat` и `q_m_chicken` рискуют получиться одинаковыми.** Существующий `char-meat.png` — это
маскот с куриной ножкой, и исходная подсказка для `q_m_chicken` была ровно такой же. Поэтому в сцене
выше для «С курицей?» — целая запечённая курица, а не ножка: иначе в одном прохождении подряд выпадут
две практически неотличимые карточки.

**Пропорции.** Все существующие маскоты — портретные 1080×1200 (9:10). Держитесь этого формата:
карточка вписывает картинку целиком, и квадрат или горизонталь будут смотреться мелко.

**Проверка.** После того как положите файлы в `public/images/questions/`, посмотреть их в приложении:

```bash
node scripts/genSql.ts          # подставит пути в SQL
MOCK_LANG=ru node scripts/mockApi.ts &
VITE_SUPABASE_URL=http://localhost:54329 VITE_SUPABASE_ANON_KEY=mock npx vite
```
