import { JourneySection } from '@/components/home/journey-section';
import { seedMedia } from '@/design/seed-media';
import type { MediaRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';

const JOURNEY_STEPS = ['journey-step-1', 'journey-step-2', 'journey-step-3', 'journey-step-4'] as const;

const journeyAlt: Record<string, { hy: string; ru: string; en: string }> = {
  'journey-step-1': {
    hy: 'Ընտրիր ոճը — երիտասարդ պարուհին ստուդիայի մուտքի մոտ',
    ru: 'Выбери стиль — девушка у входа в студию, за ней силуэты направлений',
    en: 'Pick a style — a young dancer at the studio entrance with style silhouettes behind',
  },
  'journey-step-2': {
    hy: 'Գտիր ուսուցչիդ — պարուսույցը ուղղում է աշակերտուհու ձեռքը',
    ru: 'Найди своего учителя — наставник поправляет руку ученицы',
    en: "Find your teacher — an instructor correcting a student's arm",
  },
  'journey-step-3': {
    hy: 'Ամրագրիր երկու սեղմումով — հեռախոսը բալետի հենակին',
    ru: 'Забронируй в два клика — телефон на балетном станке',
    en: 'Book in two clicks — a phone resting on a ballet barre',
  },
  'journey-step-4': {
    hy: 'Դուրս արի պարահրապարակ — DanceSport զույգը լուսարձակների ներքո',
    ru: 'Выйди на паркет — пара DanceSport под прожекторами',
    en: 'Take the floor — a DanceSport couple under spotlights',
  },
};

function journeyMediaRef(name: string): MediaRef | undefined {
  // Не передаём width/height — путь строит seedMedia() внутри <Media>,
  // иначе resolve() уходит в ветку mediaUrl(bareKey) и даёт
  // https://…r2.dev/journey-step-3 вместо /media/seed/journey-step-3.<hash>.webp (404).
  if (!seedMedia(name)) return undefined;
  return {
    key: name,
    alt: journeyAlt[name] ?? { hy: '', ru: '', en: '' },
  };
}

export function JourneyLazy({ locale }: { locale: Locale }) {
  // Всегда 4 шага — не зависит от entitlements.events
  const images = JOURNEY_STEPS.map((name) => journeyMediaRef(name)).filter(
    (v): v is MediaRef => v !== undefined,
  );

  return <JourneySection images={images} locale={locale} />;
}
