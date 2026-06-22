export type CuisineOption = {
  id: string;
  title: string;
  title_uz: string;
  description: string;
  description_uz: string;
  emoji: string;
};

export type Question = {
  id: string;
  title: string;
  title_uz: string;
  subtitle: string;
  subtitle_uz: string;
  emoji: string;
  image: string;
};

export const cuisineOptions: CuisineOption[] = [
  {
    id: 'asian',
    title: 'Азиатская',
    title_uz: 'Osiyo oshxonasi',
    description: 'Суши, вок, рамен, рис и др.',
    description_uz: 'Sushi, wok, ramen, guruch va boshq.',
    emoji: '🍣',
  },
  {
    id: 'european',
    title: 'Европейская',
    title_uz: 'Yevropa oshxonasi',
    description: 'Паста, стейк, салаты, супы и др.',
    description_uz: "Pasta, biftek, salatlar, sho'rvalar va boshq.",
    emoji: '🍝',
  },
  {
    id: 'central-asia',
    title: 'Среднеазиатская',
    title_uz: "O'rta Osiyo oshxonasi",
    description: 'Плов, лагман, манты, самса и др.',
    description_uz: "Osh, lag'mon, manti, samsa va boshq.",
    emoji: '🥟',
  },
  {
    id: 'middle-east',
    title: 'Ближневосточная',
    title_uz: 'Yaqin Sharq oshxonasi',
    description: 'Донер, кебаб, хумус, фалафель и др.',
    description_uz: 'Doner, kebab, hummus, falafel va boshq.',
    emoji: '🌯',
  },
  {
    id: 'slavic',
    title: 'Славянская',
    title_uz: 'Slavyan oshxonasi',
    description: 'Борщ, вареники, пельмени, драники и др.',
    description_uz: 'Borsh, vareniki, pelmeni, draniki va boshq.',
    emoji: '🥣',
  },
  {
    id: 'fast-food',
    title: 'Фастфуд',
    title_uz: 'Tez ovqat',
    description: 'Бургер, шаурма, хот-дог, фри и др.',
    description_uz: 'Burger, shaurma, hot-dog, fri va boshq.',
    emoji: '🍔',
  },
];

export const questions: Question[] = [
  {
    id: 'full-meal',
    title: 'Плотно поесть?',
    title_uz: "To'q yemoqchimisiz?",
    subtitle: 'Типо плова, бургера или просто перекус?',
    subtitle_uz: 'Masalan osh, burger yoki shunchaki gazak?',
    emoji: '🥩',
    image: '/src/assets/char-meal.png',
  },
  {
    id: 'with-meat',
    title: 'С мясом?',
    title_uz: "Go'shtli bo'lsinmi?",
    subtitle: 'Курица, говядина… или без мяса тоже норм?',
    subtitle_uz: "Tovuq, mol go'shti… yoki go'shtsiz ham bo'ladimi?",
    emoji: '🍗',
    image: '/src/assets/char-meat.png',
  },
  {
    id: 'hot-food',
    title: 'Горячее?',
    title_uz: 'Issiqmi?',
    subtitle: 'Что-то горячее или можно холодное?',
    subtitle_uz: 'Issiq taom yoki sovuq ham mayli?',
    emoji: '☕',
    image: '/src/assets/char-hot.png',
  },
  {
    id: 'maybe-soup',
    title: 'Может суп?',
    title_uz: "Balki sho'rva?",
    subtitle: 'Лёгкое первое или вообще не хочется жидкого?',
    subtitle_uz: "Engil birinchi taom yoki suyuq narsa kerak emas?",
    emoji: '🍲',
    image: '/src/assets/char-soup.png',
  },
  {
    id: 'need-fast',
    title: 'Нужно быстро?',
    title_uz: 'Tez kerakmi?',
    subtitle: 'Есть время перекусить или планируешь свой обед',
    subtitle_uz: 'Gazak uchun vaqtingiz bormi yoki tushlik rejalashtirmoqdasiz?',
    emoji: '⚡',
    image: '/src/assets/char-fast.png',
  },
];
