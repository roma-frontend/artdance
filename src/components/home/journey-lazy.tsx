import { JourneySection } from '@/components/home/journey-section';
import type { MediaRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';

export function JourneyLazy({
  styleImage,
  instructorImage,
  classImage,
  competitionImage,
  locale,
}: {
  styleImage?: MediaRef;
  instructorImage?: MediaRef;
  classImage?: MediaRef;
  competitionImage: MediaRef;
  locale: Locale;
}) {
  const images = [styleImage, instructorImage, classImage, competitionImage].filter(
    (v): v is MediaRef => v !== undefined,
  );
  return <JourneySection images={images} locale={locale} />;
}
