/**
 * Контент главной страницы.
 *
 * **Это единственный шов между «данными из фикстур» и «данными из базы».**
 * Сегодня функция собирает контент из демо-фикстур прототипа, потому что базы
 * ещё нет (задача 1.1 плана). Когда она появится, меняется реализация этой
 * функции — и ни одного компонента.
 *
 * Так сделано намеренно. Альтернатива — импортировать фикстуры прямо в секции —
 * привела бы к тому, что при подключении базы пришлось бы править десяток
 * компонентов, и каждый из них знал бы про имена файлов. Требование заказчика
 * «все фото и видео управляются из админки» означает, что медиа обязано быть
 * данными, а не литералом в разметке.
 *
 * Что здесь появится при переходе на базу (задача 2.1):
 *   • запрос к `MediaAsset` + `MediaAssetTranslation` вместо `demoMediaAlt`;
 *   • блоки главной из `ContentBlock` (`docs/07-feature-backlog.md`, A-17);
 *   • кеш и теги из `src/config/cache.ts` вокруг вызова;
 *   • показатели из аналитики вместо `demoHeroStats`.
 */

import 'server-only';

import {
  demoClasses,
  demoEvents,
  demoHeroStats,
  demoInstructors,
  demoProducts,
  demoReviews,
  demoStyleTiles,
  demoVenues,
} from '../../../prisma/fixtures/demo';
import type { VideoLoopKey } from '@/config/media-processing';
import type { HomeContent, MediaRef, VideoRef } from '@/domain/content';
import { videoLoops } from '@/design/video-loops.generated';

import {
  toClassCard,
  toEventCard,
  toInstructorCard,
  toProductCard,
  toStyleTile,
  toTestimonial,
  toVenueCard,
} from './catalog';
import { mediaRef } from './media';

/**
 * Ссылка на фоновую петлю.
 *
 * Одна функция на все петли главной: у первого экрана и у заявления бренда
 * различаются только имя петли и постер. Файлы собраны
 * `npm run video:encode -- --loop <петля>` по политике `videoLoopPolicy`;
 * браузер скачивает РОВНО ОДИН источник из трёх — тот, который умеет
 * декодировать аппаратно, — поэтому пользователь платит за самый лёгкий, который
 * поддерживает.
 *
 * Вес и длительность берутся из генерируемого манифеста, а не пишутся руками:
 * иначе отчёт о бюджете и админка рассказывали бы о файле то, чего в нём нет.
 *
 * Здесь же — единственное место, которое изменится при появлении бакета: путь
 * `/media/video/…` станет ключом объекта в R2, а компоненты не заметят разницы.
 */
function videoLoop(loop: VideoLoopKey, poster: MediaRef): VideoRef | null {
  const { sources, durationSeconds } = videoLoops[loop];
  if (sources.length === 0) return null;

  const lightest = sources.reduce((min, item) => (item.bytes < min.bytes ? item : min));

  return {
    sources: sources.map((item) => ({
      format: item.format,
      width: item.width,
      url: `/media/video/${item.file}`,
    })),
    poster,
    durationSeconds,
    bytes: lightest.bytes,
  };
}

/**
 * Постеры петель — первые кадры этих же петель (`designVideos[].poster`).
 *
 * Именно первый кадр, а не подходящая фотография: постер показывается до старта
 * воспроизведения, и любой другой кадр дал бы видимый скачок в момент, когда на
 * секцию смотрят.
 */
const heroPoster = (): MediaRef => mediaRef('hero-loop-poster');
const editorialPoster = (): MediaRef => mediaRef('editorial-loop-poster');

export function getHomeContent(): HomeContent {
  return {
    hero: {
      video: videoLoop('hero', heroPoster()),
      /**
       * Перевёрнутый клип для обратного прохода раскрытия. Скачивается лениво —
       * только если посетитель начал раскрытие первого экрана.
       */
      reverseVideo: videoLoop('heroReverse', heroPoster()),
      image: heroPoster(),
      stats: demoHeroStats,
    },
    styleTiles: demoStyleTiles.map(toStyleTile),
    editorial: {
      video: videoLoop('editorial', editorialPoster()),
      image: editorialPoster(),
    },
    /**
     * «Популярное сейчас». Сегодня — порядок фикстуры (сначала трендовые), в
     * production — сортировка по числу броней за `dataRevalidate` последних дней.
     */
    popularClasses: [...demoClasses]
      .sort((a, b) => Number(b.isTrending) - Number(a.isTrending))
      .map(toClassCard),
    instructors: demoInstructors.map(toInstructorCard),
    venues: demoVenues.map(toVenueCard),
    /**
     * Отзывы. В production — только прошедшие модерацию
     * (`reviews.requireModeration`) и подтверждённые покупкой.
     */
    testimonials: demoReviews.map(toTestimonial),
    products: demoProducts.map(toProductCard),
    events: demoEvents.map(toEventCard),
  };
}
