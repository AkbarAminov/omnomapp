-- Questions, places, menu_items, history.mode. Already applied if you ran 002 before.
begin;

drop table if exists public.questions;
create table public.questions (
  id text primary key,
  mode text not null check (mode in ('meal', 'snack', 'dessert')),
  tag text not null,
  question_group text,
  question_ru text not null,
  subtitle_ru text,
  question_uz text not null,
  subtitle_uz text,
  applies_to text not null default 'all',
  show_if text,
  hide_if text,
  priority int not null default 5,
  emoji text,
  image text,
  icon_hint text
);
alter table public.questions enable row level security;
create policy "questions are readable by everyone" on public.questions for select using (true);
grant select on public.questions to anon, authenticated;

insert into public.questions (id, mode, tag, question_group, question_ru, subtitle_ru, question_uz, subtitle_uz, applies_to, show_if, hide_if, priority, emoji, image, icon_hint) values
  ('q_m_heavy', 'meal', 'isHeavy', 'Ощущения', 'Сытное, чтобы наесться?', 'Или что-то лёгкое', 'To‘yimli, to‘yib olish uchunmi?', 'Yoki yengilroq narsa', 'all', null, null, 1, '🍽️', '/assets/char-meal.png', 'персонаж держится за круглый живот'),
  ('q_m_soup', 'meal', 'isSoup', 'Форма', 'Суп?', 'Что-то с бульоном и ложкой', 'Sho‘rvami?', 'Suyuq va qoshiq bilan yeyiladigan', 'asian;central-asia;european;middle-east;slavic', null, null, 1, '🍲', '/assets/char-soup.png', 'персонаж с дымящейся миской'),
  ('q_m_meat', 'meal', 'hasMeat', 'Основа', 'С мясом?', 'Говядина, баранина, курица', 'Go‘shtli bo‘lsinmi?', 'Mol, qo‘y yoki tovuq go‘shti', 'all', null, null, 2, '🍗', '/assets/char-meat.png', 'персонаж с куриной ножкой'),
  ('q_m_noodles', 'meal', 'hasNoodles', 'Форма', 'Лапша или паста?', 'Лагман, рамен, спагетти', 'Lag‘mon yoki pasta?', 'Lag‘mon, ramen, spagetti', 'asian;central-asia;european;slavic', null, null, 2, '🍜', null, 'персонаж накручивает лапшу на палочки'),
  ('q_m_rice', 'meal', 'hasRice', 'Форма', 'Рис — основа блюда?', 'Плов, роллы, ризотто, жареный рис', 'Guruch — taomning asosimi?', 'Osh, rollar, rizotto, qovurilgan guruch', 'asian;central-asia;european;middle-east', null, null, 2, '🍚', null, 'персонаж с горкой риса'),
  ('q_m_dough', 'meal', 'hasDough', 'Форма', 'Тесто — главное в блюде?', 'Самса, пельмени, пицца, пирожки', 'Xamir — taomning asosimi?', 'Somsa, chuchvara, pitsa, pirojki', 'all', null, null, 2, '🥐', null, 'персонаж с самсой в руках'),
  ('q_m_hot', 'meal', 'isHot', 'Ощущения', 'Горячее?', 'Или можно холодное', 'Issiq bo‘lsinmi?', 'Yoki sovuq ham bo‘laveradi', 'all', null, null, 3, '🔥', '/assets/char-hot.png', 'персонаж с дымящейся чашкой'),
  ('q_m_fried', 'meal', 'isFried', 'Способ', 'Хрустящее, с корочкой?', 'Во фритюре или зажаренное до хруста', 'Qarsildoq, qobiqli bo‘lsinmi?', 'Frityurda yoki qizartirib qovurilgan', 'all', null, 'isSoup=yes', 3, '🍟', null, 'персонаж со сковородкой'),
  ('q_m_grilled', 'meal', 'isGrilled', 'Способ', 'С гриля или мангала?', 'Шашлык, стейк, кебаб', 'Gril yoki mangaldanmi?', 'Shashlik, steyk, kabob', 'central-asia;european;middle-east', null, 'isSoup=yes', 3, '🍢', null, 'персонаж у мангала с шампуром'),
  ('q_m_seafood', 'meal', 'hasSeafood', 'Основа', 'Рыба или морепродукты?', 'Роллы, креветки, форель', 'Baliq yoki dengiz mahsulotlarimi?', 'Rollar, krevetka, forel', 'asian;european;middle-east;slavic', null, 'hasMeat=yes', 3, '🐟', null, 'персонаж с рыбкой'),
  ('q_m_dumpling', 'meal', 'isDumpling', 'Форма', 'Пельмени или манты?', 'Тесто с начинкой внутри', 'Chuchvara yoki manti?', 'Ichligi bor xamir', 'asian;central-asia;european;middle-east;slavic', 'hasDough=yes', null, 3, '🥟', null, 'персонаж лепит пельмень'),
  ('q_m_spicy', 'meal', 'isSpicy', 'Ощущения', 'Остренькое?', 'Чтобы немного жгло', 'Achchiqroq bo‘lsinmi?', 'Biroz achishtirsin', 'asian;middle-east;fast-food', null, null, 4, '🌶️', null, 'персонаж с красным перцем и паром из ушей'),
  ('q_m_fast', 'meal', 'isFast', 'Формат', 'Нужно по-быстрому?', 'Готово за пару минут, можно взять с собой', 'Tezkor narsa kerakmi?', 'Bir necha daqiqada tayyor, olib ketsa bo‘ladi', 'asian;middle-east', null, null, 4, '⚡', '/assets/char-fast.png', 'персонаж бежит с пакетом еды'),
  ('q_m_hands', 'meal', 'byHand', 'Формат', 'Чтобы есть руками?', 'Без вилки и ножа', 'Qo‘l bilan yeyiladiganmi?', 'Vilka va pichoqsiz', 'all', null, 'isSoup=yes', 4, '🤲', null, 'персонаж держит бургер двумя руками'),
  ('q_m_steamed', 'meal', 'isSteamed', 'Способ', 'На пару?', 'Манты, ханум', 'Bug‘da pishganmi?', 'Manti, xonim', 'central-asia', 'hasDough=yes', null, 4, '♨️', null, 'персонаж в облаке пара над пароваркой'),
  ('q_m_cheese', 'meal', 'hasCheese', 'Основа', 'Сыр — заметная часть блюда?', 'Тянется или чувствуется на вкус', 'Pishloq sezilarli bo‘lsinmi?', 'Cho‘ziladi yoki ta’mi seziladi', 'asian;european;fast-food;middle-east;slavic', null, 'isSoup=yes', 5, '🧀', null, 'персонаж с тянущимся сыром'),
  ('q_m_veggies', 'meal', 'hasVeggies', 'Основа', 'Овощи — главное в блюде?', 'Салат, рагу, овощи гриль', 'Sabzavot — taomning asosimi?', 'Salat, ragu, gril sabzavotlar', 'all', null, null, 5, '🥦', null, 'персонаж с корзинкой овощей'),
  ('q_m_fatty', 'meal', 'isFatty', 'Ощущения', 'Жирное, на масле?', 'Плов, самса, фри — не диетическое', 'Yog‘li, moyli bo‘lsinmi?', 'Osh, somsa, fri — parhezbop emas', 'all', null, 'isHeavy=no', 5, '🤤', null, 'персонаж облизывается над сочным блюдом'),
  ('q_m_sweet', 'meal', 'isSweet', 'Ощущения', 'Сладенькое?', 'Сырники, блины с вареньем', 'Shirinroq bo‘lsinmi?', 'Sirniki, murabboli blin', 'slavic', null, null, 6, '🍯', null, 'персонаж с баночкой варенья'),
  ('q_s_heavy', 'snack', 'isHeavy', 'Ощущения', 'Посытнее?', 'Или совсем лёгкий перекус', 'To‘yimliroq bo‘lsinmi?', 'Yoki juda yengil tamaddi', 'all', null, null, 1, '🍽️', '/assets/char-meal.png', 'персонаж держится за живот'),
  ('q_s_hot', 'snack', 'isHot', 'Ощущения', 'Горячее?', 'Или можно холодное', 'Issiq bo‘lsinmi?', 'Yoki sovuq ham bo‘laveradi', 'all', null, null, 2, '🔥', '/assets/char-hot.png', 'персонаж с дымящейся чашкой'),
  ('q_s_asian', 'snack', 'cuisine:asian', 'Направление', 'Что-то азиатское?', 'Роллы, гёдза, спринг-роллы', 'Osiyocha bo‘lsinmi?', 'Rollar, gyoza, spring roll', 'all', null, null, 2, '🥢', null, 'персонаж с палочками для еды'),
  ('q_s_fastfood', 'snack', 'cuisine:fast-food', 'Направление', 'Фастфуд?', 'Бургер, хот-дог, наггетсы', 'Fastfud bo‘lsinmi?', 'Burger, hot-dog, naggetslar', 'all', null, null, 2, '🍔', null, 'персонаж с бургером и газировкой'),
  ('q_s_east', 'snack', 'cuisine:middle-east', 'Направление', 'Что-то восточное?', 'Лепёшки, мезе, донер', 'Sharqona bo‘lsinmi?', 'Non, meze, doner', 'all', null, null, 3, '🧆', null, 'персонаж с лепёшкой и соусами'),
  ('q_s_europe', 'snack', 'cuisine:european', 'Направление', 'Европейская закуска?', 'Брускетта, паштет, буррата', 'Yevropacha gazakmi?', 'Brusketta, pashtet, burrata', 'all', null, null, 3, '🥖', null, 'персонаж с багетом'),
  ('q_s_fried', 'snack', 'isFried', 'Способ', 'Хрустящее, с корочкой?', 'Во фритюре или зажаренное до хруста', 'Qarsildoq, qobiqli bo‘lsinmi?', 'Frityurda yoki qizartirib qovurilgan', 'all', null, null, 3, '🍟', null, 'персонаж со сковородкой'),
  ('q_s_meat', 'snack', 'hasMeat', 'Основа', 'С мясом или курицей?', 'Что-то мясное', 'Go‘sht yoki tovuqli?', 'Go‘shtli narsa', 'all', null, null, 3, '🍗', '/assets/char-meat.png', 'персонаж с куриной ножкой'),
  ('q_s_seafood', 'snack', 'hasSeafood', 'Основа', 'Рыба или морепродукты?', 'Роллы, креветки', 'Baliq yoki dengiz mahsulotlarimi?', 'Rollar, krevetka', 'all', null, 'hasMeat=yes', 4, '🐟', null, 'персонаж с рыбкой'),
  ('q_s_dough', 'snack', 'hasDough', 'Форма', 'Выпечка или лепёшка?', 'Самса, пирожки, пиде', 'Pishiriq yoki nonmi?', 'Somsa, pirojki, pide', 'all', null, null, 4, '🥐', null, 'персонаж с самсой в руках'),
  ('q_s_cheese', 'snack', 'hasCheese', 'Основа', 'Сыр — заметная часть?', 'Тянется или чувствуется на вкус', 'Pishloq sezilarli bo‘lsinmi?', 'Cho‘ziladi yoki ta’mi seziladi', 'all', null, null, 4, '🧀', null, 'персонаж с тянущимся сыром'),
  ('q_s_spicy', 'snack', 'isSpicy', 'Ощущения', 'Остренькое?', 'Чтобы немного жгло', 'Achchiqroq bo‘lsinmi?', 'Biroz achishtirsin', 'all', null, null, 5, '🌶️', null, 'персонаж с красным перцем'),
  ('q_s_hands', 'snack', 'byHand', 'Формат', 'Чтобы есть руками?', 'Без вилки и ножа', 'Qo‘l bilan yeyiladiganmi?', 'Vilka va pichoqsiz', 'all', null, null, 5, '🤲', null, 'персонаж держит бургер двумя руками'),
  ('q_s_veggies', 'snack', 'hasVeggies', 'Основа', 'Овощи — главное?', 'Салатик, овощи, мезе', 'Sabzavot — asosiymi?', 'Salat, sabzavot, meze', 'all', null, null, 5, '🥦', null, 'персонаж с корзинкой овощей'),
  ('q_d_hot', 'dessert', 'isHot', 'Ощущения', 'Тёплое?', 'Блины, катмер, сырники', 'Iliq bo‘lsinmi?', 'Blin, katmer, sirniki', 'all', null, null, 1, '🔥', null, 'персонаж с тёплой тарелкой блинов'),
  ('q_d_east', 'dessert', 'cuisine:middle-east', 'Направление', 'Восточные сладости?', 'Баклава, катмер, каймак', 'Sharq shirinliklarimi?', 'Baklava, katmer, qaymoq', 'all', null, null, 2, '🍯', null, 'персонаж с подносом баклавы'),
  ('q_d_home', 'dessert', 'cuisine:slavic', 'Направление', 'Как в детстве?', 'Медовик, «Картошка», блины, сырники', 'Bolalikdagidek bo‘lsinmi?', 'Medovik, «Kartoshka», blin, sirniki', 'all', null, null, 2, '🥞', null, 'персонаж в фартуке с тортом'),
  ('q_d_choc', 'dessert', 'hasChocolate', 'Вкус', 'С шоколадом?', 'Брауни, торт, тарт', 'Shokoladli bo‘lsinmi?', 'Brauni, tort, tart', 'all', null, null, 3, '🍫', null, 'персонаж с плиткой шоколада'),
  ('q_d_creamy', 'dessert', 'isCreamy', 'Вкус', 'Нежное и кремовое?', 'Крем, сливки, творог', 'Kremli va yumshoqmi?', 'Krem, qaymoq, tvorog', 'all', null, null, 3, '🍰', null, 'персонаж с куском торта'),
  ('q_d_fruity', 'dessert', 'isFruity', 'Вкус', 'Фруктовое или ягодное?', 'Сорбет, ягоды, варенье', 'Mevali yoki rezavorli?', 'Sorbet, rezavor, murabbo', 'all', null, null, 4, '🍓', null, 'персонаж с клубникой'),
  ('q_d_nuts', 'dessert', 'allergen:nuts', 'Вкус', 'С орехами?', 'Фисташки, грецкий орех', 'Yong‘oqli bo‘lsinmi?', 'Pista, yong‘oq', 'all', null, null, 4, '🥜', null, 'персонаж с горстью фисташек'),
  ('q_d_frozen', 'dessert', 'isFrozen', 'Формат', 'Холодное, как мороженое?', 'Мороженое, джелато, сорбет', 'Muzqaymoqdek sovuq bo‘lsinmi?', 'Muzqaymoq, jelato, sorbet', 'all', null, 'isHot=yes', 5, '🍨', null, 'персонаж с рожком мороженого'),
  ('q_d_hands', 'dessert', 'byHand', 'Формат', 'Чтобы взять рукой?', 'Пирожок, брауни, канноли', 'Qo‘lda yeyiladiganmi?', 'Pirojki, brauni, kannoli', 'all', null, null, 5, '🤲', null, 'персонаж держит пирожок'),
  ('q_m_chicken', 'meal', 'hasChicken', 'Основа', 'С курицей?', 'Курица, а не говядина или баранина', 'Tovuqli bo‘lsinmi?', 'Mol yoki qo‘y emas, tovuq go‘shti', 'all', null, 'hasMeat=no', 2, '🐔', null, 'персонаж с куриной ножкой в руке'),
  ('q_m_wrap', 'meal', 'isWrap', 'Форма', 'Завёрнуто в лаваш или тортилью?', 'Шаурма, дюрюм, буррито, ролл', 'Lavash yoki tortilyaga o‘ralganmi?', 'Shaurma, dyurum, burrito, roll', 'fast-food;middle-east', null, 'isSoup=yes', 3, '🌯', null, 'персонаж держит шаурму'),
  ('q_s_chicken', 'snack', 'hasChicken', 'Основа', 'С курицей?', 'Курица, а не говядина или баранина', 'Tovuqli bo‘lsinmi?', 'Mol yoki qo‘y emas, tovuq go‘shti', 'all', null, 'hasMeat=no', 3, '🐔', null, 'персонаж с куриной ножкой в руке'),
  ('q_s_wrap', 'snack', 'isWrap', 'Форма', 'Завёрнуто в лаваш или тортилью?', 'Шаурма, дюрюм, ролл', 'Lavash yoki tortilyaga o‘ralganmi?', 'Shaurma, dyurum, roll', 'all', null, null, 4, '🌯', null, 'персонаж держит шаурму');


-- places & menu items («Что рядом?», «Локации»)
drop table if exists public.menu_items;
drop table if exists public.places;
create table public.places (
  id text primary key,
  name text not null,
  district text,
  address text,
  lat double precision,
  lng double precision,
  express24_url text,
  yandex_eda_url text,
  is_active boolean not null default true
);
create table public.menu_items (
  id text primary key,
  place_id text not null references public.places(id) on delete cascade,
  dish_id text not null,
  price integer,
  url text
);
create index menu_items_dish_id_idx on public.menu_items (dish_id);
alter table public.places enable row level security;
alter table public.menu_items enable row level security;
create policy "places are readable by everyone" on public.places for select using (true);
create policy "menu items are readable by everyone" on public.menu_items for select using (true);
grant select on public.places, public.menu_items to anon, authenticated;

-- history: which mode produced the pick
alter table public.history add column if not exists mode text;

commit;
