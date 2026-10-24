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
import { site } from '@/config/site';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { publicClassWhere } from '@/server/queries/classes';
import { publicInstructorWhere } from '@/server/queries/instructors';
import { publicProductWhere } from '@/server/queries/products';

const DAY_MS = 86_400_000;
/** Окно расписания: дальше две недели ассистент не знает, и это честнее, чем гадать. */
const SCHEDULE_DAYS = 14;
/** Потолки, чтобы промпт не рос с каталогом: длинный контекст дорог и размывает ответ. */
const LIMITS = { classes: 60, sessions: 120, instructors: 50, products: 60 } as const;

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
function pickTitle(base: string, translations: { locale: string; title: string }[], locale: Locale): string {
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

/**
 * Текстовый снимок каталога и расписания на языке клиента.
 * Возвращает строку, которую вставляют в системный промпт как ДАННЫЕ.
 */
export async function loadKnowledgeText(locale: Locale, now: Date): Promise<string> {
  const horizon = new Date(now.getTime() + SCHEDULE_DAYS * DAY_MS);

  const [classes, sessions, instructors, products] = await Promise.all([
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
        startsAt: true,
        capacity: true,
        bookedCount: true,
        danceClass: {
          select: {
            title: true,
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
  ]);

  const classLines = classes.map((c) => {
    const title = pickTitle(c.title, c.translations, locale);
    const teacher = c.instructor.user.name ?? 'instructor';
    return `- [${c.slug}] ${title} | ${c.style} | ${c.level} | ${c.lessonType} | ${c.durationMinutes} min | from ${formatPrice(c.price)} | teacher: ${teacher}`;
  });

  const sessionLines = sessions.map((s) => {
    const title = pickTitle(s.danceClass.title, s.danceClass.translations, locale);
    const spotsLeft = Math.max(0, s.capacity - s.bookedCount);
    return `- ${formatDateTime(s.startsAt)} (Yerevan) | ${title} | spots left: ${spotsLeft}`;
  });

  const instructorLines = instructors.map((i) => {
    const name = i.user.name ?? 'instructor';
    const verified = i.isVerified ? ', verified' : '';
    const specs = i.specializations.length ? ` | specializations: ${i.specializations.join(', ')}` : '';
    return `- [${i.slug}] ${name}${verified} | ${i.headline} | styles: ${i.styles.join(', ')}${specs} | ${i.yearsExperience} yrs | from ${formatPrice(i.hourlyRateFrom)}/hour`;
  });

  const productLines = products.map((p) => {
    const title = pickTitle(p.title, p.translations, locale);
    const brand = p.brand ? ` (${p.brand})` : '';
    return `- [${p.slug}] ${title}${brand} | from ${formatPrice(p.basePrice)}`;
  });

  const sections = [
    `NOW: ${formatDateTime(now)} (Yerevan time)`,
    renderContacts(),
    renderPolicies(),
    `CLASSES (catalog)\n${classLines.join('\n') || '- none'}`,
    `UPCOMING SESSIONS (next ${SCHEDULE_DAYS} days)\n${sessionLines.join('\n') || '- none scheduled'}`,
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

  if (rows.length === 0) return 'CLIENT BOOKINGS\n- no upcoming bookings';

  const lines = rows.map((r) => {
    const title = r.session ? pickTitle(r.session.danceClass.title, r.session.danceClass.translations, locale) : 'booking';
    return `- ${r.reference} | ${title} | ${formatDateTime(r.startsAt)} (Yerevan) | ${r.status} | ${formatPrice(r.totalPrice)}`;
  });

  return `CLIENT BOOKINGS\n${lines.join('\n')}`;
}
