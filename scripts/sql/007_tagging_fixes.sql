-- Правки разметки, найденные прогоном scripts/personas.ts:
--   byHand: мезе и жареные закуски едят руками, как наггетсы и фри
--   plov hasVeggies: морковь не делает плов овощным блюдом
--   olivier: убраны две «середины» (0.5 = нет информации)
-- Безопасно перезапускать.

begin;

update public.dishes set "isHeavy" = '0.25', "isFatty" = '0.25', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '1' where id = 'hummus-04';
update public.dishes set "isHeavy" = '0', "isFatty" = '0.25', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'yes', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '1' where id = 'baba-ganoush-11';
update public.dishes set "isHeavy" = '0', "isFatty" = '0.25', "isSpicy" = '0.5', "isSweet" = '0', "hasVeggies" = 'yes', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '0.25' where id = 'muhammara-251';
update public.dishes set "isHeavy" = '0', "isFatty" = '0', "isSpicy" = '0.75', "isSweet" = '0', "hasVeggies" = 'yes', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '0.25' where id = 'ezme-255';
update public.dishes set "isHeavy" = '0', "isFatty" = '0.25', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '0.25' where id = 'haydari-254';
update public.dishes set "isHeavy" = '0', "isFatty" = '0.25', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '0.25' where id = 'taramosalata-253';
update public.dishes set "isHeavy" = '0', "isFatty" = '0.25', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'any', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '0.25' where id = 'labneh-beet-259';
update public.dishes set "isHeavy" = '0.25', "isFatty" = '0.25', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '0.25' where id = 'labneh-lentil-260';
update public.dishes set "isHeavy" = '0.25', "isFatty" = '0.75', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'yes', "byHand" = 'yes', "prominence" = '0.5' where id = 'chicken-liver-pate-85';
update public.dishes set "isHeavy" = '0.25', "isFatty" = '0.75', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '1' where id = 'tempura-09';
update public.dishes set "isHeavy" = '0.5', "isFatty" = '0.75', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'yes', "byHand" = 'yes', "prominence" = '0.5' where id = 'karaage-chicken-59';
update public.dishes set "isHeavy" = '0.25', "isFatty" = '0.75', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '0.5' where id = 'potato-croquettes-60';
update public.dishes set "isHeavy" = '0.25', "isFatty" = '1', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'no', "byHand" = 'yes', "prominence" = '0.5' where id = 'fried-mozzarella-61';
update public.dishes set "isHeavy" = '1', "isFatty" = '0.75', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'no', "hasMeat" = 'yes', "byHand" = 'no', "prominence" = '1' where id = 'plov-01';
update public.dishes set "isHeavy" = '0.25', "isFatty" = '0.75', "isSpicy" = '0', "isSweet" = '0', "hasVeggies" = 'any', "hasMeat" = 'yes', "byHand" = 'no', "prominence" = '1' where id = 'olivier-277';

commit;
