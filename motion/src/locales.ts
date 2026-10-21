/**
 * ТЕКСТЫ РОЛИКА НА ТРЁХ ЯЗЫКАХ — ru / en / hy.
 *
 * Источник — каталоги проекта `src/i18n/messages/`, а не перевод «на слух»:
 * названия направлений взяты из `danceStyles`, тон — из `hero`. Имена
 * инструкторов и площадок — из `prisma/fixtures/demo.ts`, цены оттуда же
 * (в драмах). Так ролик не расходится с сайтом ни в одном слове.
 *
 * Армянский — не подстрочник: у проекта свой голос для hy
 * («Դասեր, մարզիչներ, ստուդիաներ…»), и здесь он сохранён.
 *
 * Раскладка `RTL` не нужна: все три языка пишутся слева направо.
 */

export const LOCALES = ['ru', 'en', 'hy'] as const;
export type Locale = (typeof LOCALES)[number];

/** Строка данных в карточке этапа. */
export interface RowCopy {
  label: string;
  value: string;
  /** Акцентная строка — бургунди + золотая точка, как «сигнал» в бренд-системе */
  accent?: boolean;
  /** Превью: луп направления или фото. Одинаково для всех языков */
  img?: string;
}

export interface StageCopy {
  title: string;
  sub: string;
  rows: RowCopy[];
}

export interface Copy {
  /** Хук: две строки, вторая — курсивом золотом */
  hookLine1: string;
  hookLine2: string;
  /** Перечисление под хуком */
  hookList: string;
  stages: StageCopy[];
  /** Финальная подпись под лого */
  tagline: string;
  /** Три факта в финале */
  facts: { label: string; value: string; accent?: boolean }[];
  footer: string;
}

/* Превью одинаковы во всех локалях — держим их отдельно, чтобы не дублировать. */
const TILES = ['assets/tiles/salsa.mp4', 'assets/tiles/contemporary.mp4', 'assets/tiles/hiphop.mp4', 'assets/tiles/ballet.mp4'];
const INSTR = ['assets/instr-anna.webp', 'assets/instr-arman.webp', 'assets/instr-nare.webp'];
const STUDIOS = ['assets/studio-pulse.webp', 'assets/studio-rhythm.webp', 'assets/studio-flow.webp'];
const PRODUCTS = ['assets/prod-shoes.webp', 'assets/prod-bag.webp', 'assets/prod-giftcard.webp'];

const ru: Copy = {
  hookLine1: 'Танцы Армении',
  hookLine2: 'в одном месте',
  hookList: 'Занятия · Инструкторы · Площадки · Магазин',
  stages: [
    {
      title: 'Каталог',
      sub: '18 направлений. Фильтры по стилю, уровню, дате и району.',
      rows: [
        { label: 'Латина', value: '5 залов', accent: true, img: TILES[0] },
        { label: 'Контемпорари', value: '7 залов', img: TILES[1] },
        { label: 'Хип-хоп', value: '4 зала', img: TILES[2] },
        { label: 'Балет', value: '3 зала', img: TILES[3] },
      ],
    },
    {
      title: 'Инструкторы',
      sub: 'Профиль, опыт, языки преподавания, рейтинг.',
      rows: [
        { label: 'Анна Мкртчян', value: 'Латина · 4.9', img: INSTR[0] },
        { label: 'Арман Арутюнян', value: 'Хип-хоп · 4.8', img: INSTR[1] },
        { label: 'Наре Григорян', value: 'Контемпорари · 5.0', accent: true, img: INSTR[2] },
      ],
    },
    {
      title: 'Площадки',
      sub: 'Залы, оснащение, календарь и почасовая аренда.',
      rows: [
        { label: 'Pulse Dance Studio', value: '20 000 ֏/час', accent: true, img: STUDIOS[0] },
        { label: 'Rhythm Space', value: '25 000 ֏/час', img: STUDIOS[1] },
        { label: 'Flow Studio', value: '15 000 ֏/час', img: STUDIOS[2] },
      ],
    },
    {
      title: 'Магазин',
      sub: 'Экипировка, обувь, подарочные карты.',
      rows: [
        { label: 'Обувь для сальсы', value: '12 500 ֏', img: PRODUCTS[0] },
        { label: 'Сумка для танцев', value: '18 000 ֏', img: PRODUCTS[1] },
        { label: 'Подарочная карта', value: 'от 10 000 ֏', accent: true, img: PRODUCTS[2] },
      ],
    },
    {
      title: 'Бронирование',
      sub: 'Слот, удержание места, оплата в драмах.',
      rows: [
        { label: 'Суббота, 18:00', value: '8 мест', accent: true },
        { label: 'Удержание слота', value: '15 мин' },
        { label: 'Оплата', value: 'AMD ֏' },
      ],
    },
    {
      title: 'Четыре кабинета',
      sub: 'Клиент, инструктор, площадка, админ.',
      rows: [
        { label: 'Клиент', value: 'брони и заказы' },
        { label: 'Инструктор', value: 'расписание и доходы' },
        { label: 'Площадка', value: 'залы и календарь' },
        { label: 'Админ', value: 'модерация и выплаты', accent: true },
      ],
    },
  ],
  tagline: 'Маркетплейс танцев Армении',
  facts: [
    { label: 'направлений', value: '18' },
    { label: 'роли пользователей', value: '4', accent: true },
    { label: 'языка', value: '3' },
  ],
  footer: 'Ереван · hy / ru / en · оплата в драмах',
};

const en: Copy = {
  hookLine1: "Armenia's dance scene",
  hookLine2: 'in one place',
  hookList: 'Classes · Instructors · Studios · Shop',
  stages: [
    {
      title: 'Catalog',
      sub: '18 dance styles. Filters by style, level, date and district.',
      rows: [
        { label: 'Latin', value: '5 studios', accent: true, img: TILES[0] },
        { label: 'Contemporary', value: '7 studios', img: TILES[1] },
        { label: 'Hip-Hop', value: '4 studios', img: TILES[2] },
        { label: 'Ballet', value: '3 studios', img: TILES[3] },
      ],
    },
    {
      title: 'Instructors',
      sub: 'Profile, experience, teaching languages, rating.',
      rows: [
        { label: 'Anna Mkrtchyan', value: 'Latin · 4.9', img: INSTR[0] },
        { label: 'Arman Harutyunyan', value: 'Hip-Hop · 4.8', img: INSTR[1] },
        { label: 'Nare Grigoryan', value: 'Contemporary · 5.0', accent: true, img: INSTR[2] },
      ],
    },
    {
      title: 'Studios',
      sub: 'Halls, equipment, calendar and hourly rental.',
      rows: [
        { label: 'Pulse Dance Studio', value: '20 000 ֏/hr', accent: true, img: STUDIOS[0] },
        { label: 'Rhythm Space', value: '25 000 ֏/hr', img: STUDIOS[1] },
        { label: 'Flow Studio', value: '15 000 ֏/hr', img: STUDIOS[2] },
      ],
    },
    {
      title: 'Shop',
      sub: 'Apparel, shoes, gift cards.',
      rows: [
        { label: 'Salsa shoes', value: '12 500 ֏', img: PRODUCTS[0] },
        { label: 'Dance bag', value: '18 000 ֏', img: PRODUCTS[1] },
        { label: 'Gift card', value: 'from 10 000 ֏', accent: true, img: PRODUCTS[2] },
      ],
    },
    {
      title: 'Booking',
      sub: 'Slot, seat hold, payment in drams.',
      rows: [
        { label: 'Saturday, 18:00', value: '8 seats', accent: true },
        { label: 'Seat hold', value: '15 min' },
        { label: 'Payment', value: 'AMD ֏' },
      ],
    },
    {
      title: 'Four dashboards',
      sub: 'Customer, instructor, venue, admin.',
      rows: [
        { label: 'Customer', value: 'bookings and orders' },
        { label: 'Instructor', value: 'schedule and income' },
        { label: 'Venue', value: 'halls and calendar' },
        { label: 'Admin', value: 'moderation and payouts', accent: true },
      ],
    },
  ],
  tagline: "Armenia's dance marketplace",
  facts: [
    { label: 'dance styles', value: '18' },
    { label: 'user roles', value: '4', accent: true },
    { label: 'languages', value: '3' },
  ],
  footer: 'Yerevan · hy / ru / en · payments in drams',
};

const hy: Copy = {
  hookLine1: 'Հայաստանի պարը',
  hookLine2: 'մեկ տեղում',
  hookList: 'Դասեր · Մարզիչներ · Դահլիճներ · Խանութ',
  stages: [
    {
      title: 'Կատալոգ',
      sub: '18 ուղղություն։ Զտիչներ ըստ ոճի, մակարդակի, ամսաթվի և շրջանի։',
      rows: [
        { label: 'Լատինական', value: '5 դահլիճ', accent: true, img: TILES[0] },
        { label: 'Կոնտեմպորարի', value: '7 դահլիճ', img: TILES[1] },
        { label: 'Հիփ-հոփ', value: '4 դահլիճ', img: TILES[2] },
        { label: 'Բալետ', value: '3 դահլիճ', img: TILES[3] },
      ],
    },
    {
      title: 'Մարզիչներ',
      sub: 'Պրոֆիլ, փորձ, դասավանդման լեզուներ, վարկանիշ։',
      rows: [
        { label: 'Աննա Մկրտչյան', value: 'Լատինական · 4.9', img: INSTR[0] },
        { label: 'Արման Հարությունյան', value: 'Հիփ-հոփ · 4.8', img: INSTR[1] },
        { label: 'Նարե Գրիգորյան', value: 'Կոնտեմպորարի · 5.0', accent: true, img: INSTR[2] },
      ],
    },
    {
      title: 'Դահլիճներ',
      sub: 'Դահլիճներ, սարքավորում, օրացույց և ժամավճար։',
      rows: [
        { label: 'Pulse Dance Studio', value: '20 000 ֏/ժ', accent: true, img: STUDIOS[0] },
        { label: 'Rhythm Space', value: '25 000 ֏/ժ', img: STUDIOS[1] },
        { label: 'Flow Studio', value: '15 000 ֏/ժ', img: STUDIOS[2] },
      ],
    },
    {
      title: 'Խանութ',
      sub: 'Հագուստ, կոշիկ, նվեր քարտեր։',
      rows: [
        { label: 'Սալսայի կոշիկ', value: '12 500 ֏', img: PRODUCTS[0] },
        { label: 'Պարային պայուսակ', value: '18 000 ֏', img: PRODUCTS[1] },
        { label: 'Նվեր քարտ', value: '10 000 ֏-ից', accent: true, img: PRODUCTS[2] },
      ],
    },
    {
      title: 'Ամրագրում',
      sub: 'Ժամ, տեղի պահում, վճարում դրամով։',
      rows: [
        { label: 'Շաբաթ, 18:00', value: '8 տեղ', accent: true },
        { label: 'Տեղի պահում', value: '15 ր' },
        { label: 'Վճարում', value: 'AMD ֏' },
      ],
    },
    {
      title: 'Չորս վահանակ',
      sub: 'Հաճախորդ, մարզիչ, դահլիճ, ադմին։',
      rows: [
        { label: 'Հաճախորդ', value: 'ամրագրումներ և պատվերներ' },
        { label: 'Մարզիչ', value: 'ժամանակացույց և եկամուտ' },
        { label: 'Դահլիճ', value: 'դահլիճներ և օրացույց' },
        { label: 'Ադմին', value: 'մոդերացիա և վճարումներ', accent: true },
      ],
    },
  ],
  tagline: 'Հայաստանի պարային հարթակը',
  facts: [
    { label: 'ուղղություն', value: '18' },
    { label: 'օգտվողի դեր', value: '4', accent: true },
    { label: 'լեզու', value: '3' },
  ],
  footer: 'Երևան · hy / ru / en · վճարում դրամով',
};

export const COPY: Record<Locale, Copy> = { ru, en, hy };

/**
 * Шрифты под язык.
 *
 * Playfair Display не покрывает армянский алфавит, а Manrope — кириллицу.
 * Поэтому у каждой локали своя пара, и обе гарнитуры внутри пары из одной
 * семьи по характеру: серифная антиква для заголовков, гротеск для текста.
 * Набор шрифтов для hy — Noto Serif/Sans Armenian, те же, что в проекте
 * (`src/design/fonts.ts`).
 */
export const FONTS: Record<Locale, { display: string; sans: string }> = {
  ru: { display: 'Playfair Display', sans: 'Manrope' },
  en: { display: 'Playfair Display', sans: 'DM Sans' },
  hy: { display: 'Noto Serif Armenian', sans: 'Noto Sans Armenian' },
};

/**
 * Масштаб заголовка под язык.
 *
 * Армянский и английский длиннее русского: «Четыре кабинета» — 15 знаков,
 * «Four dashboards» — 15, но шире по глифам, а «Չորս վահանակ» ещё шире.
 * Без этого заголовок уходит за край кадра.
 */
export const TITLE_SCALE: Record<Locale, number> = { ru: 1, en: 0.92, hy: 0.86 };
