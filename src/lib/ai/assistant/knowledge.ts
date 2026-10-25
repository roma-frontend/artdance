/**
 * Знания ассистента: снимок платформы и данные текущего клиента.
 *
 * Берём только то, что видит любой посетитель каталога: те же публичные условия,
 * что и страницы. Внутренние документы (коммерческое предложение, безопасность,
 * регламенты оператора) сюда не попадают: ассистент отвечает клиентам, и всё,
 * что попало в промпт, он может пересказать.
 *
 * Снимок строится на каждый запрос, без кеша: расписание и места меняются, а
 * ответ с устаревшими местами — это обещание, которого платформа не может выполнить.
 */
import { booking, currency } from '@/config/business';
import { subscriptionPlanIds, subscriptionPlans } from '@/config/pricing';
import { routes } from '@/config/routes';
import { absoluteUrl, site } from '@/config/site';
import { notTrashed } from '@/domain/trash';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import type { FaqGroup } from '@/components/content/faq-accordion';
import { buildFaqGroups } from '@/server/content/faq';
import { publicClassWhere } from '@/server/queries/classes';
import { publicEventWhere } from '@/server/queries/events';
import { publicInstructorWhere } from '@/server/queries/instructors';
import { publicProductWhere } from '@/server/queries/products';
import { publicVenueWhere } from '@/server/queries/venues';

const DAY_MS = 86_400_000;
/** Окно расписания: дальше две недели ассистент не знает, и это честнее, чем гадать. */
const SCHEDULE_DAYS = 14;
/** Потолки, чтобы промпт не рос с каталогом: длинный контекст дорог и размывает ответ. */
const LIMITS = { classes: 60, sessions: 120, instructors: 50, products: 60, studios: 40, events: 30, faq: 40 } as const;

const YEREVAN = 'Asia/Yerevan';

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: YEREVAN,
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

/** Название на языке клиента, а если перевода нет — базовое. */
export function pickTitle(base: string, translations: { locale: string; title: string }[], locale: Locale): string {
  return translations.find((t) => t.locale === locale)?.title ?? base;
}

function formatPrice(amount: number): string {
  return `${amount} ${currency.code}`;
}

/** Политики отмены и переноса — из конфигурации, а не из текста, который можно устареть. */
function renderPolicies(): string {
  return [
    'POLICIES',
    `- Cancellation free until ${booking.freeCancellationHours} hours before the start. Later cancellation keeps ${Math.round(
      booking.lateCancellationFeeRate * 100,
    )}% of the amount. No-show is charged ${Math.round(booking.noShowFeeRate * 100)}%.`,
    `- Reschedule free until ${booking.freeRescheduleHours} hours before the start, up to ${booking.maxReschedulesPerBooking} times per booking.`,
    `- A slot is held for ${booking.holdTtlMinutes} minutes during checkout. An unpaid booking is cancelled after ${booking.unpaidExpiryMinutes} minutes.`,
    `- Prices are in ${currency.code}.`,
  ].join('\n');
}

function renderContacts(): string {
  const lines = [
    'STUDIO',
    `- Brand: ${site.name}, dance studio platform in ${site.address.city}, ${site.address.countryName}.`,
    `- General contact: ${site.contact.email}. Support: ${site.contact.supportEmail}.`,
  ];
  if (site.contact.phone) lines.push(`- Phone: ${site.contact.phone}.`);
  if (site.contact.whatsapp) lines.push(`- WhatsApp: ${site.contact.whatsapp}.`);
  if (site.contact.telegram) lines.push(`- Telegram: ${site.contact.telegram}.`);
  return lines.join('\n');
}

/** Абсолютный адрес страницы в языке клиента. Ассистент берёт ссылки только отсюда. */
function pageUrl(locale: Locale, path: string): string {
  return absoluteUrl(`/${locale}${path}`);
}

/** Ключевые страницы сайта: ссылки, которые ассистент может дать клиенту. */
function renderPages(locale: Locale): string {
  const pages: [string, string][] = [
    ['Classes catalog', routes.classes()],
    ['Dance styles', routes.styles()],
    ['Instructors', routes.instructors()],
    ['Studios and rental halls', routes.studios()],
    ['Events and competitions', routes.events()],
    ['Competitions', routes.competitions()],
    ['Social events', routes.socialEvents()],
    ['Schedule', routes.schedule()],
    ['Shop', routes.shop()],
    ['Gift cards', routes.giftCards()],
    ['Subscription plans and prices', routes.pricing()],
    ['Cart', routes.cart()],
    ['FAQ', routes.faq()],
    ['Help center', routes.help()],
    ['Contact', routes.contact()],
    ['Sign up', routes.signUp()],
    ['My bookings', routes.accountBookings()],
    ['My orders', routes.accountOrders()],
    ['My subscription', routes.accountSubscription()],
    ['Become an instructor', routes.becomeInstructor()],
    ['List your studio', routes.listYourStudio()],
    ['Cancellation policy', routes.cancellationPolicy()],
    ['Refund policy', routes.refundPolicy()],
  ];
  return ['PAGES', ...pages.map(([label, path]) => `- ${label}: ${pageUrl(locale, path)}`)].join('\n');
}

/** Как оформить заказ. Ассистент сам ничего не оформляет: он даёт шаги и ссылки. */
function renderOrdering(locale: Locale): string {
  return [
    'HOW TO ORDER (the assistant cannot place orders, book or pay; the client does it on the site)',
    '- Group class: open the class link from CLASSES, choose a session time in the schedule, then confirm and pay at checkout.',
    '- Private lesson: open the instructor link from INSTRUCTORS and book a time on their page.',
    '- Studio or hall rental: open the studio link from STUDIOS and use its booking link.',
    '- Event, competition or social event: open the event link from EVENTS and register on its page.',
    `- Shop product: open the product link from SHOP, add it to the cart, then check out. Cart: ${pageUrl(locale, routes.cart())}`,
    `- Gift card: ${pageUrl(locale, routes.giftCards())}`,
    `- Subscription: choose a plan on ${pageUrl(locale, routes.pricing())} and check out.`,
    `- If a step fails or a change is needed, write to ${site.contact.supportEmail}.`,
  ].join('\n');
}

/** Тарифы абонементов: цены и квоты из конфигурации. */
function renderPlans(): string {
  const lines = subscriptionPlanIds.map((id) => {
    const plan = subscriptionPlans[id];
    const group =
      plan.quota.groupClassesPerMonth === 'unlimited'
        ? 'unlimited group classes'
        : `${plan.quota.groupClassesPerMonth} group classes per month`;
    const trial = plan.trialDays ? ` | ${plan.trialDays}-day trial` : '';
    const recommended = plan.highlighted ? ' | recommended' : '';
    return `- ${id} | ${formatPrice(plan.price.MONTHLY)} per month | ${formatPrice(plan.price.YEARLY)} per year (save ${plan.yearlyDiscountPercent}%) | ${group}${trial}${recommended}`;
  });
  return ['SUBSCRIPTION PLANS', ...lines].join('\n');
}

/**
 * Частые вопросы и ответы из той же базы, что и страница FAQ. Ассистент отвечает
 * на вопросы о политике и порядке действий по этим ответам, а не по догадкам.
 */
function renderFaq(groups: FaqGroup[]): string {
  const lines = groups
    .flatMap((group) => group.items.map((item) => `- Q: ${item.question}\n  A: ${item.answer}`))
    .slice(0, LIMITS.faq);
  return ['FAQ', ...lines].join('\n');
}

/**
 * Текстовый снимок каталога и расписания на языке клиента.
 * Возвращает строку, которую вставляют в системный промпт как ДАННЫЕ.
 */
export async function loadKnowledgeText(locale: Locale, now: Date): Promise<string> {
  const horizon = new Date(now.getTime() + SCHEDULE_DAYS * DAY_MS);

  const [classes, sessions, instructors, products, studios, events, faqGroups] = await Promise.all([
    db.danceClass.findMany({
      where: publicClassWhere,
      take: LIMITS.classes,
      orderBy: { title: 'asc' },
      select: {
        slug: true,
        title: true,
        style: true,
        level: true,
        lessonType: true,
        durationMinutes: true,
        price: true,
        translations: { select: { locale: true, title: true } },
        instructor: { select: { user: { select: { name: true } } } },
      },
    }),
    db.classSession.findMany({
      where: {
        isCancelled: false,
        startsAt: { gte: now, lte: horizon },
        danceClass: publicClassWhere,
      },
      take: LIMITS.sessions,
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        capacity: true,
        bookedCount: true,
        danceClass: {
          select: {
            slug: true,
            title: true,
            style: true,
            level: true,
            translations: { select: { locale: true, title: true } },
          },
        },
      },
    }),
    db.instructorProfile.findMany({
      where: publicInstructorWhere,
      take: LIMITS.instructors,
      select: {
        slug: true,
        headline: true,
        styles: true,
        specializations: true,
        yearsExperience: true,
        hourlyRateFrom: true,
        isVerified: true,
        user: { select: { name: true } },
      },
    }),
    db.product.findMany({
      where: publicProductWhere,
      take: LIMITS.products,
      orderBy: { title: 'asc' },
      select: { slug: true, title: true, brand: true, basePrice: true, translations: { select: { locale: true, title: true } } },
    }),
    db.venue.findMany({
      where: publicVenueWhere,
      take: LIMITS.studios,
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    }),
    db.event.findMany({
      where: publicEventWhere(now),
      take: LIMITS.events,
      orderBy: { startsAt: 'asc' },
      select: {
        slug: true,
        type: true,
        title: true,
        startsAt: true,
        price: true,
        locationName: true,
        translations: { select: { locale: true, title: true } },
      },
    }),
    buildFaqGroups(locale),
  ]);

  const classLines = classes.map((c) => {
    const title = pickTitle(c.title, c.translations, locale);
    const teacher = c.instructor.user.name ?? 'instructor';
    return `- [${c.slug}] ${title} | ${c.style} | ${c.level} | ${c.lessonType} | ${c.durationMinutes} min | from ${formatPrice(c.price)} | teacher: ${teacher} | ${pageUrl(locale, routes.class(c.slug))}`;
  });

  const openSessions = sessions.filter((s) => s.bookedCount < s.capacity);
  const sessionLines = openSessions.map((s) => {
    const title = pickTitle(s.danceClass.title, s.danceClass.translations, locale);
    const spotsLeft = s.capacity - s.bookedCount;
    return `- [${s.id}] ${formatDateTime(s.startsAt)} (Yerevan) | ${title} | ${s.danceClass.style} | ${s.danceClass.level} | spots left: ${spotsLeft} | ${pageUrl(locale, routes.class(s.danceClass.slug))}`;
  });

  const instructorLines = instructors.map((i) => {
    const name = i.user.name ?? 'instructor';
    const verified = i.isVerified ? ', verified' : '';
    const specs = i.specializations.length ? ` | specializations: ${i.specializations.join(', ')}` : '';
    return `- [${i.slug}] ${name}${verified} | ${i.headline} | styles: ${i.styles.join(', ')}${specs} | ${i.yearsExperience} yrs | from ${formatPrice(i.hourlyRateFrom)}/hour | ${pageUrl(locale, routes.instructor(i.slug))}`;
  });

  const productLines = products.map((p) => {
    const title = pickTitle(p.title, p.translations, locale);
    const brand = p.brand ? ` (${p.brand})` : '';
    return `- [${p.slug}] ${title}${brand} | from ${formatPrice(p.basePrice)} | ${pageUrl(locale, routes.product(p.slug))}`;
  });

  const studioLines = studios.map(
    (v) =>
      `- [${v.slug}] ${v.name} | page: ${pageUrl(locale, routes.studio(v.slug))} | booking: ${pageUrl(locale, routes.studioBooking(v.slug))}`,
  );

  const eventLines = events.map((e) => {
    const title = pickTitle(e.title, e.translations, locale);
    const price = e.price > 0 ? `from ${formatPrice(e.price)}` : 'free';
    const place = e.locationName ? ` | ${e.locationName}` : '';
    return `- [${e.slug}] ${title} | ${e.type} | ${formatDateTime(e.startsAt)} (Yerevan) | ${price}${place} | ${pageUrl(locale, routes.event(e.slug))}`;
  });

  const sections = [
    `NOW: ${formatDateTime(now)} (Yerevan time)`,
    renderContacts(),
    renderPages(locale),
    renderOrdering(locale),
    renderPolicies(),
    renderFaq(faqGroups),
    renderPlans(),
    `STUDIOS AND HALLS\n${studioLines.join('\n') || '- none'}`,
    `EVENTS AND COMPETITIONS (upcoming)\n${eventLines.join('\n') || '- none'}`,
    `CLASSES (catalog)\n${classLines.join('\n') || '- none'}`,
    `UPCOMING SESSIONS (next ${SCHEDULE_DAYS} days, open spots only; the [ID] is used only in a booking token)\n${sessionLines.join('\n') || '- none scheduled'}`,
    `INSTRUCTORS\n${instructorLines.join('\n') || '- none'}`,
    `SHOP\n${productLines.join('\n') || '- none'}`,
  ];

  return sections.join('\n\n');
}

/**
 * Личный контекст клиента: его ближайшие брони. Только его собственные строки,
 * userId берётся из проверенной сессии, а не из тела запроса.
 */
export async function loadPersonalContext(userId: string, locale: Locale, now: Date): Promise<string> {
  const rows = await db.booking.findMany({
    where: {
      customerId: userId,
      startsAt: { gte: now },
      status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
    },
    orderBy: { startsAt: 'asc' },
    take: 10,
    select: {
      reference: true,
      startsAt: true,
      status: true,
      totalPrice: true,
      session: { select: { danceClass: { select: { title: true, translations: { select: { locale: true, title: true } } } } } },
    },
  });

  const myBookings = `- my bookings page: ${pageUrl(locale, routes.accountBookings())}`;
  if (rows.length === 0) return `CLIENT BOOKINGS\n- no upcoming bookings\n${myBookings}`;

  const lines = rows.map((r) => {
    const title = r.session ? pickTitle(r.session.danceClass.title, r.session.danceClass.translations, locale) : 'booking';
    return `- ${r.reference} | ${title} | ${formatDateTime(r.startsAt)} (Yerevan) | ${r.status} | ${formatPrice(r.totalPrice)}`;
  });

  return `CLIENT BOOKINGS\n${lines.join('\n')}\n${myBookings}`;
}

/**
 * Профиль танцора из анкеты и стили, которые клиент уже посещал. Заметки
 * преподавателя (`note`) сюда не попадают: они предназначены для преподавателя.
 */
export async function loadClientProfile(userId: string): Promise<string> {
  const [profile, attended] = await Promise.all([
    db.dancerProfile.findUnique({ where: { userId }, select: { level: true, styles: true, goal: true } }),
    db.booking.findMany({
      where: { customerId: userId, status: 'COMPLETED' },
      orderBy: { startsAt: 'desc' },
      take: 30,
      select: { session: { select: { danceClass: { select: { style: true } } } } },
    }),
  ]);

  const styleCounts = new Map<string, number>();
  for (const row of attended) {
    const style = row.session?.danceClass.style;
    if (style) styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);
  }
  const attendedStyles = [...styleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([style, count]) => `${style} (${count})`);

  const lines = ['CLIENT PROFILE'];
  lines.push(profile ? `- level: ${profile.level}` : '- level: not set');
  lines.push(profile?.styles.length ? `- interested in: ${profile.styles.join(', ')}` : '- interested in: not set');
  if (profile?.goal) lines.push(`- goal (client's own words): ${profile.goal}`);
  lines.push(
    attendedStyles.length ? `- attended before: ${attendedStyles.join(', ')}` : '- attended before: no completed classes yet',
  );
  return lines.join('\n');
}

const PARTNER_ROLES = new Set(['INSTRUCTOR', 'VENUE_OWNER']);

/**
 * Статистика партнёра: только его собственные занятия и залы. Суммы валовые
 * (сумма броней), без вычета комиссии. Чужие данные сюда не попадают.
 */
export async function loadPartnerContext(caller: { id: string; role: string }, locale: Locale, now: Date): Promise<string> {
  if (!PARTNER_ROLES.has(caller.role)) return '';

  const instructor =
    caller.role === 'INSTRUCTOR'
      ? await db.instructorProfile.findFirst({ where: { userId: caller.id, ...notTrashed }, select: { id: true } })
      : null;
  const venueIds =
    caller.role === 'VENUE_OWNER'
      ? (await db.venueMember.findMany({ where: { userId: caller.id }, select: { venueId: true } })).map((m) => m.venueId)
      : [];

  if (!instructor && venueIds.length === 0) return '';

  const ownerWhere = instructor ? { instructorId: instructor.id } : { venueId: { in: venueIds } };
  const pastFrom = new Date(now.getTime() - 30 * DAY_MS);
  const weekAhead = new Date(now.getTime() + 7 * DAY_MS);

  const [done, cancelled, upcoming, sessions] = await Promise.all([
    db.booking.aggregate({
      where: { ...ownerWhere, status: { in: ['CONFIRMED', 'COMPLETED'] }, startsAt: { gte: pastFrom, lt: now } },
      _count: { _all: true },
      _sum: { totalPrice: true },
    }),
    db.booking.count({
      where: {
        ...ownerWhere,
        status: { in: ['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_PROVIDER'] },
        startsAt: { gte: pastFrom, lt: now },
      },
    }),
    db.booking.count({
      where: { ...ownerWhere, status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] }, startsAt: { gte: now, lt: weekAhead } },
    }),
    instructor
      ? db.classSession.findMany({
          where: {
            ...notTrashed,
            isCancelled: false,
            startsAt: { gte: now, lt: weekAhead },
            danceClass: { ...notTrashed, instructorId: instructor.id },
          },
          take: 30,
          orderBy: { startsAt: 'asc' },
          select: {
            startsAt: true,
            capacity: true,
            bookedCount: true,
            danceClass: { select: { title: true, translations: { select: { locale: true, title: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const sessionLines = sessions.map((s) => {
    const title = pickTitle(s.danceClass.title, s.danceClass.translations, locale);
    return `  - ${formatDateTime(s.startsAt)} (Yerevan) | ${title} | booked ${s.bookedCount}/${s.capacity}`;
  });

  return [
    'PARTNER DATA (own data only; gross booked amounts, before commission, in ' + currency.code + ')',
    `- bookings last 30 days (confirmed or completed): ${done._count._all}, booked amount ${formatPrice(Number(done._sum.totalPrice ?? 0))}`,
    `- cancelled bookings last 30 days: ${cancelled}`,
    `- bookings next 7 days: ${upcoming}`,
    ...(instructor ? ['- sessions next 7 days:', ...(sessionLines.length ? sessionLines : ['  - none'])] : []),
  ].join('\n');
}
