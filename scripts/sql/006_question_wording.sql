-- Question wording, style Б: every question is a short description of what you want.
-- isFatty no longer says «на масле» (read as deep-fried) but «жирное и сочное»,
-- so it stops competing with isFried and isHeavy. Safe to re-run.

begin;

update public.questions set question_ru = 'Сытное, чтобы наесться?', subtitle_ru = 'Или что-то лёгкое', question_uz = 'To‘yimli, to‘yib olish uchunmi?', subtitle_uz = 'Yoki yengilroq narsa' where id = 'q_m_heavy';
update public.questions set question_ru = 'Суп?', subtitle_ru = 'Что-то с бульоном и ложкой', question_uz = 'Sho‘rvami?', subtitle_uz = 'Suyuq va qoshiq bilan yeyiladigan' where id = 'q_m_soup';
update public.questions set question_ru = 'С мясом?', subtitle_ru = 'Говядина, баранина, курица', question_uz = 'Go‘shtli bo‘lsinmi?', subtitle_uz = 'Mol, qo‘y yoki tovuq go‘shti' where id = 'q_m_meat';
update public.questions set question_ru = 'Лапша или паста?', subtitle_ru = 'Лагман, рамен, спагетти', question_uz = 'Lag‘mon yoki pasta?', subtitle_uz = 'Lag‘mon, ramen, spagetti' where id = 'q_m_noodles';
update public.questions set question_ru = 'На рисе?', subtitle_ru = 'Плов, ризотто, роллы, жареный рис', question_uz = 'Guruch asosidami?', subtitle_uz = 'Osh, rizotto, rollar, qovurilgan guruch' where id = 'q_m_rice';
update public.questions set question_ru = 'На тесте?', subtitle_ru = 'Самса, пельмени, пицца, пирожки', question_uz = 'Xamir asosidami?', subtitle_uz = 'Somsa, chuchvara, pitsa, pirojki' where id = 'q_m_dough';
update public.questions set question_ru = 'Горячее?', subtitle_ru = 'Или можно холодное', question_uz = 'Issiq bo‘lsinmi?', subtitle_uz = 'Yoki sovuq ham bo‘laveradi' where id = 'q_m_hot';
update public.questions set question_ru = 'С хрустящей корочкой?', subtitle_ru = 'Зажаренное до хруста', question_uz = 'Qarsildoq qobiqlimi?', subtitle_uz = 'Qizartirib qovurilgan' where id = 'q_m_fried';
update public.questions set question_ru = 'С гриля или мангала?', subtitle_ru = 'Шашлык, стейк, кебаб', question_uz = 'Gril yoki mangaldanmi?', subtitle_uz = 'Shashlik, steyk, kabob' where id = 'q_m_grilled';
update public.questions set question_ru = 'Рыба или морепродукты?', subtitle_ru = 'Роллы, креветки, форель', question_uz = 'Baliq yoki dengiz mahsulotlarimi?', subtitle_uz = 'Rollar, krevetka, forel' where id = 'q_m_seafood';
update public.questions set question_ru = 'Пельмени или манты?', subtitle_ru = 'Тесто с начинкой внутри', question_uz = 'Chuchvara yoki manti?', subtitle_uz = 'Ichligi bor xamir' where id = 'q_m_dumpling';
update public.questions set question_ru = 'Острое?', subtitle_ru = 'Чтобы немного жгло', question_uz = 'Achchiq bo‘lsinmi?', subtitle_uz = 'Biroz achishtirsin' where id = 'q_m_spicy';
update public.questions set question_ru = 'По-быстрому?', subtitle_ru = 'Готово за пару минут, можно взять с собой', question_uz = 'Tezkor bo‘lsinmi?', subtitle_uz = 'Bir necha daqiqada tayyor, olib ketsa bo‘ladi' where id = 'q_m_fast';
update public.questions set question_ru = 'Руками, без приборов?', subtitle_ru = 'Без вилки и ножа', question_uz = 'Qo‘l bilan yeyiladiganmi?', subtitle_uz = 'Vilka va pichoqsiz' where id = 'q_m_hands';
update public.questions set question_ru = 'На пару?', subtitle_ru = 'Манты, ханум', question_uz = 'Bug‘da pishganmi?', subtitle_uz = 'Manti, xonim' where id = 'q_m_steamed';
update public.questions set question_ru = 'С сыром?', subtitle_ru = 'Тянется или чувствуется на вкус', question_uz = 'Pishloqli bo‘lsinmi?', subtitle_uz = 'Cho‘ziladi yoki ta’mi seziladi' where id = 'q_m_cheese';
update public.questions set question_ru = 'Овощное?', subtitle_ru = 'Салат, рагу, овощи гриль', question_uz = 'Sabzavotli bo‘lsinmi?', subtitle_uz = 'Salat, ragu, gril sabzavotlar' where id = 'q_m_veggies';
update public.questions set question_ru = 'Жирное и сочное?', subtitle_ru = 'Плов, казан-кабоб, паста со сливками — насыщенный вкус', question_uz = 'Yog‘li va sersuv bo‘lsinmi?', subtitle_uz = 'Osh, qozon-kabob, qaymoqli pasta — boy ta’m' where id = 'q_m_fatty';
update public.questions set question_ru = 'Сладкое?', subtitle_ru = 'Сырники, блины с вареньем', question_uz = 'Shirin bo‘lsinmi?', subtitle_uz = 'Sirniki, murabboli blin' where id = 'q_m_sweet';
update public.questions set question_ru = 'Сытное?', subtitle_ru = 'Или совсем лёгкий перекус', question_uz = 'To‘yimli bo‘lsinmi?', subtitle_uz = 'Yoki juda yengil tamaddi' where id = 'q_s_heavy';
update public.questions set question_ru = 'Горячее?', subtitle_ru = 'Или можно холодное', question_uz = 'Issiq bo‘lsinmi?', subtitle_uz = 'Yoki sovuq ham bo‘laveradi' where id = 'q_s_hot';
update public.questions set question_ru = 'Азиатское?', subtitle_ru = 'Роллы, гёдза, спринг-роллы', question_uz = 'Osiyocha bo‘lsinmi?', subtitle_uz = 'Rollar, gyoza, spring roll' where id = 'q_s_asian';
update public.questions set question_ru = 'Фастфуд?', subtitle_ru = 'Бургер, хот-дог, наггетсы', question_uz = 'Fastfud bo‘lsinmi?', subtitle_uz = 'Burger, hot-dog, naggetslar' where id = 'q_s_fastfood';
update public.questions set question_ru = 'Восточное?', subtitle_ru = 'Лепёшки, мезе, донер', question_uz = 'Sharqona bo‘lsinmi?', subtitle_uz = 'Non, meze, doner' where id = 'q_s_east';
update public.questions set question_ru = 'Европейское?', subtitle_ru = 'Брускетта, паштет, буррата', question_uz = 'Yevropacha bo‘lsinmi?', subtitle_uz = 'Brusketta, pashtet, burrata' where id = 'q_s_europe';
update public.questions set question_ru = 'С хрустящей корочкой?', subtitle_ru = 'Зажаренное до хруста', question_uz = 'Qarsildoq qobiqlimi?', subtitle_uz = 'Qizartirib qovurilgan' where id = 'q_s_fried';
update public.questions set question_ru = 'С мясом?', subtitle_ru = 'Говядина, баранина, курица', question_uz = 'Go‘shtli bo‘lsinmi?', subtitle_uz = 'Mol, qo‘y yoki tovuq go‘shti' where id = 'q_s_meat';
update public.questions set question_ru = 'Рыба или морепродукты?', subtitle_ru = 'Роллы, креветки', question_uz = 'Baliq yoki dengiz mahsulotlarimi?', subtitle_uz = 'Rollar, krevetka' where id = 'q_s_seafood';
update public.questions set question_ru = 'Выпечка или лепёшка?', subtitle_ru = 'Самса, пирожки, пиде', question_uz = 'Pishiriq yoki nonmi?', subtitle_uz = 'Somsa, pirojki, pide' where id = 'q_s_dough';
update public.questions set question_ru = 'С сыром?', subtitle_ru = 'Тянется или чувствуется на вкус', question_uz = 'Pishloqli bo‘lsinmi?', subtitle_uz = 'Cho‘ziladi yoki ta’mi seziladi' where id = 'q_s_cheese';
update public.questions set question_ru = 'Острое?', subtitle_ru = 'Чтобы немного жгло', question_uz = 'Achchiq bo‘lsinmi?', subtitle_uz = 'Biroz achishtirsin' where id = 'q_s_spicy';
update public.questions set question_ru = 'Руками, без приборов?', subtitle_ru = 'Без вилки и ножа', question_uz = 'Qo‘l bilan yeyiladiganmi?', subtitle_uz = 'Vilka va pichoqsiz' where id = 'q_s_hands';
update public.questions set question_ru = 'Овощное?', subtitle_ru = 'Салат, овощи, мезе', question_uz = 'Sabzavotli bo‘lsinmi?', subtitle_uz = 'Salat, sabzavot, meze' where id = 'q_s_veggies';
update public.questions set question_ru = 'Тёплое?', subtitle_ru = 'Блины, катмер, сырники', question_uz = 'Iliq bo‘lsinmi?', subtitle_uz = 'Blin, katmer, sirniki' where id = 'q_d_hot';
update public.questions set question_ru = 'Восточные сладости?', subtitle_ru = 'Баклава, катмер, каймак', question_uz = 'Sharq shirinliklarimi?', subtitle_uz = 'Baklava, katmer, qaymoq' where id = 'q_d_east';
update public.questions set question_ru = 'Домашнее, как в детстве?', subtitle_ru = 'Медовик, «Картошка», блины, сырники', question_uz = 'Uydagidek, bolalikdagidekmi?', subtitle_uz = 'Medovik, «Kartoshka», blin, sirniki' where id = 'q_d_home';
update public.questions set question_ru = 'С шоколадом?', subtitle_ru = 'Брауни, торт, тарт', question_uz = 'Shokoladli bo‘lsinmi?', subtitle_uz = 'Brauni, tort, tart' where id = 'q_d_choc';
update public.questions set question_ru = 'Нежное и кремовое?', subtitle_ru = 'Крем, сливки, творог', question_uz = 'Kremli va yumshoqmi?', subtitle_uz = 'Krem, qaymoq, tvorog' where id = 'q_d_creamy';
update public.questions set question_ru = 'Фруктовое или ягодное?', subtitle_ru = 'Сорбет, ягоды, варенье', question_uz = 'Mevali yoki rezavorli?', subtitle_uz = 'Sorbet, rezavor, murabbo' where id = 'q_d_fruity';
update public.questions set question_ru = 'С орехами?', subtitle_ru = 'Фисташки, грецкий орех', question_uz = 'Yong‘oqli bo‘lsinmi?', subtitle_uz = 'Pista, yong‘oq' where id = 'q_d_nuts';
update public.questions set question_ru = 'Холодное, как мороженое?', subtitle_ru = 'Мороженое, джелато, сорбет', question_uz = 'Muzqaymoqdek sovuq bo‘lsinmi?', subtitle_uz = 'Muzqaymoq, jelato, sorbet' where id = 'q_d_frozen';
update public.questions set question_ru = 'Руками, без приборов?', subtitle_ru = 'Пирожок, брауни, канноли', question_uz = 'Qo‘l bilan yeyiladiganmi?', subtitle_uz = 'Pirojki, brauni, kannoli' where id = 'q_d_hands';
update public.questions set question_ru = 'С курицей?', subtitle_ru = 'Курица, а не говядина или баранина', question_uz = 'Tovuqli bo‘lsinmi?', subtitle_uz = 'Mol yoki qo‘y emas, tovuq go‘shti' where id = 'q_m_chicken';
update public.questions set question_ru = 'В лаваше или тортилье?', subtitle_ru = 'Шаурма, дюрюм, буррито, ролл', question_uz = 'Lavash yoki tortilyadami?', subtitle_uz = 'Shaurma, dyurum, burrito, roll' where id = 'q_m_wrap';
update public.questions set question_ru = 'С курицей?', subtitle_ru = 'Курица, а не говядина или баранина', question_uz = 'Tovuqli bo‘lsinmi?', subtitle_uz = 'Mol yoki qo‘y emas, tovuq go‘shti' where id = 'q_s_chicken';
update public.questions set question_ru = 'В лаваше или тортилье?', subtitle_ru = 'Шаурма, дюрюм, ролл', question_uz = 'Lavash yoki tortilyadami?', subtitle_uz = 'Shaurma, dyurum, roll' where id = 'q_s_wrap';

commit;
