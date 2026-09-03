/**
 * STYLE MARQUEE — бегущая строка направлений на акцентном фоне.
 *
 * Список направлений дублируется дважды: анимация сдвигает дорожку ровно на
 * половину её ширины, поэтому в момент перезапуска кадр совпадает с начальным и
 * шва не видно. Дубль помечен `aria-hidden` — иначе скринридер прочитает
 * двадцать направлений вместо десяти.
 *
 * Вся строка декоративна: те же направления доступны в навигации и в сетке ниже,
 * поэтому целиком `aria-hidden`. Бегущий текст, который нельзя остановить, —
 * нарушение WCAG 2.2.2, и здесь оно закрыто дважды: анимация останавливается
 * при наведении и не запускается при `prefers-reduced-motion`.
 *
 * Направления берутся из домена, а не из вёрстки: добавили стиль в `danceStyles`
 * — он появился и в строке.
 */

import { useTranslations } from 'next-intl';

import { danceStyleLabelKey, danceStyles } from '@/domain/enums';
import { cn } from '@/lib/utils';

/** Сколько направлений показывать: строка должна читаться, а не мелькать. */
const VISIBLE_STYLES = 10;

export function StyleMarquee({ className }: { className?: string }) {
  const t = useTranslations();
  const items = danceStyles.slice(0, VISIBLE_STYLES);

  const row = (duplicate: boolean) => (
    <ul aria-hidden={duplicate} className="marquee-row">
      {items.map((style) => (
        <li key={style} className="text-eyebrow flex items-center gap-3 text-content-on-accent">
          {t(danceStyleLabelKey(style) as 'danceStyles.hipHop')}
          <i aria-hidden className="size-1 shrink-0 rounded-full bg-metal" />
        </li>
      ))}
    </ul>
  );

  return (
    <div aria-hidden className={cn('marquee overflow-hidden bg-accent py-3', className)}>
      <div className="marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
