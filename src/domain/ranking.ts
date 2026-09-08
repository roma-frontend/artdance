/**
 * РАНЖИРОВАНИЕ — единственная формула порядка выдачи.
 *
 * Почему это `src/domain/`, а не `ORDER BY` в запросе: порядок в листинге решает,
 * кто получит бронь. Как только сортировка появляется в двух местах, у платформы
 * появляются две разные политики распределения дохода, и объяснить исполнителю
 * его позицию становится нельзя. Здесь она одна, чистая и покрыта тестами.
 *
 * ## Что учитывается и почему именно так
 *
 * **Оценка сглаживается по числу отзывов.** 5.0 по одному отзыву — не сигнал, а
 * случайность. Байесовское сглаживание тянет среднюю к приору платформы тем
 * сильнее, чем меньше отзывов, поэтому «4.9 по 128» стоит выше «5.0 по 2».
 *
 * **Надёжность наказывает сильнее, чем награждает оценка.** Отмена со стороны
 * исполнителя и особенно неявка ломают чужие планы, и репутационный вес у них
 * выше, чем у полбалла в среднем. Вес `reliability` — второй по величине.
 *
 * **Новичок получает временную поддержку, а не преимущество.** Без первой брони
 * не бывает первого отзыва, поэтому бонус компенсирует отсутствующие сигналы и
 * убывает до нуля за `newcomer.windowDays`.
 *
 * **Платный буст добавляется отдельной строкой.** Он не растворён в счёте: разбор
 * (`rankingBreakdown`) показывает его как отдельный вклад, и карточку можно
 * честно пометить в интерфейсе.
 *
 * ## Чего здесь нет
 *
 * Расстояния до пользователя и персонализации. И то, и другое делает выдачу
 * неповторяемой: два человека увидят разный порядок, и спор «почему я ниже»
 * станет неразрешимым. Близость — это фильтр (`withinRadius`), а не вес.
 *
 * `now` всегда параметром: тесты не зависят от даты запуска.
 */

import { ranking } from '@/config/ranking';
import { reviews } from '@/config/business';

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

/**
 * Сигналы одного исполнителя или занятия.
 *
 * Поля обязательные: «не знаем» — это ноль, и подставлять ноль должен слой
 * данных осознанно, а не тип по умолчанию. Иначе забытое поле тихо опускает
 * исполнителя в конец выдачи, и найти причину невозможно.
 */
export interface RankingSignals {
  /** Средняя оценка в шкале `reviews.minRating`…`reviews.maxRating`. */
  averageRating: number;
  reviewCount: number;
  /** Доля занятых мест на прошедших занятиях, 0…1. */
  fillRate: number;
  /** Среднее время ответа на заявку в минутах. */
  responseTimeMinutes: number;
  /** Доля отмен по инициативе исполнителя, 0…1. */
  cancellationRate: number;
  /** Доля неявок исполнителя, 0…1. */
  noShowRate: number;
  completedBookings: number;
  /**
   * Когда появился на платформе — для поддержки новичка.
   *
   * `null` — «давно или неизвестно»: поддержка не применяется. Это не то же
   * самое, что дата в прошлом, и различие нужно там, где данных о регистрации
   * нет (импорт, демо-каталог): подставлять выдуманную дату значило бы выдать или
   * отнять бонус по совпадению.
   */
  createdAt: Date | null;
  isVerified: boolean;
  /** До какого момента действует платное продвижение. `null` — нет. */
  boostedUntil: Date | null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Оценка со сглаживанием, приведённая к 0…1.
 *
 * Формула: (сумма оценок + приор × сила сглаживания) / (число отзывов + сила),
 * затем нормализация по шкале отзывов. При нуле отзывов получается ровно приор —
 * то есть «средний по платформе», а не «худший».
 */
function ratingSignal(averageRating: number, reviewCount: number): number {
  const count = Math.max(0, reviewCount);
  const prior = ranking.reviewConfidenceCount;
  const smoothed =
    (averageRating * count + ranking.ratingPrior * prior) / (count + prior);

  const span = reviews.maxRating - reviews.minRating;
  if (span <= 0) return 0;
  return clamp01((smoothed - reviews.minRating) / span);
}

/** Объём отзывов: линейно до `reviewConfidenceCount`, дальше — полный сигнал. */
function reviewVolumeSignal(reviewCount: number): number {
  return clamp01(reviewCount / ranking.reviewConfidenceCount);
}

/** Скорость ответа: чем меньше минут, тем выше. Сутки и больше — ноль. */
function responsivenessSignal(responseTimeMinutes: number): number {
  if (responseTimeMinutes <= 0) return 1;
  return clamp01(1 - responseTimeMinutes / ranking.responseTimeCeilingMinutes);
}

/** Надёжность: единица минус отмены и неявки, где неявка весит больше. */
function reliabilitySignal(cancellationRate: number, noShowRate: number): number {
  const failure =
    clamp01(cancellationRate) + clamp01(noShowRate) * ranking.noShowSeverity;
  return clamp01(1 - failure);
}

/** Опыт на платформе: линейно до порога насыщения. */
function experienceSignal(completedBookings: number): number {
  return clamp01(completedBookings / ranking.experienceSaturationBookings);
}

/**
 * Поддержка новичка: полный бонус в день появления, ноль по истечении окна.
 *
 * Убывает линейно, а не ступенькой: ступенька означала бы, что на 31-й день
 * исполнитель падает на десять позиций за одну ночь без всякой причины.
 */
export function newcomerBonus(createdAt: Date | null, now: Date): number {
  if (createdAt === null) return 0;

  const ageDays = (now.getTime() - createdAt.getTime()) / MS_PER_DAY;
  if (!Number.isFinite(ageDays)) return 0;
  /* Дата создания в будущем — ошибка данных, а не повод выдать максимум. */
  if (ageDays < 0) return 0;
  if (ageDays >= ranking.newcomer.windowDays) return 0;

  return ranking.newcomer.maxBonus * (1 - ageDays / ranking.newcomer.windowDays);
}

/** Активно ли платное продвижение в этот момент. */
export function isBoosted(boostedUntil: Date | null, now: Date): boolean {
  return boostedUntil !== null && boostedUntil.getTime() > now.getTime();
}

export interface RankingBreakdown {
  /** Вклад каждого сигнала в счёт: вес × нормализованное значение. */
  signals: Record<keyof typeof ranking.weights, number>;
  /** Базовый счёт 0…100 — сумма вкладов сигналов. */
  base: number;
  newcomerBonus: number;
  boostedBonus: number;
  total: number;
}

/**
 * Разбор счёта — для кабинета исполнителя и админки.
 *
 * Нужен не «для красоты»: вопрос «почему я на пятом месте» задаст каждый второй
 * исполнитель, и ответ «так решил алгоритм» стоит платформе исполнителя.
 * Разбор считается той же формулой, что и счёт, поэтому не может с ней разойтись.
 */
export function rankingBreakdown(signals: RankingSignals, now: Date): RankingBreakdown {
  const { weights } = ranking;

  const contributions = {
    rating: weights.rating * ratingSignal(signals.averageRating, signals.reviewCount),
    reviewVolume: weights.reviewVolume * reviewVolumeSignal(signals.reviewCount),
    fillRate: weights.fillRate * clamp01(signals.fillRate),
    responsiveness: weights.responsiveness * responsivenessSignal(signals.responseTimeMinutes),
    reliability:
      weights.reliability * reliabilitySignal(signals.cancellationRate, signals.noShowRate),
    experience: weights.experience * experienceSignal(signals.completedBookings),
    verification: weights.verification * (signals.isVerified ? 1 : 0),
  } satisfies Record<keyof typeof weights, number>;

  const base = Object.values(contributions).reduce((sum, value) => sum + value, 0);
  const newcomer = newcomerBonus(signals.createdAt, now);
  const boosted = isBoosted(signals.boostedUntil, now) ? ranking.boostedBonus : 0;

  return {
    signals: contributions,
    base,
    newcomerBonus: newcomer,
    boostedBonus: boosted,
    total: base + newcomer + boosted,
  };
}

/** Счёт для сортировки: больше — выше в выдаче. */
export function computeRankingScore(signals: RankingSignals, now: Date): number {
  return rankingBreakdown(signals, now).total;
}

/**
 * Ключ сортировки `relevance` в каталоге.
 *
 * `sortByOption` ждёт возрастающий ключ («чем меньше, тем выше»), а счёт
 * ранжирования убывающий. Инверсия делается здесь, один раз, а не минусом по
 * месту вызова: минус, забытый в одном листинге, разворачивает выдачу и выглядит
 * как «каталог показывает худших первыми».
 */
export function relevanceKey(signals: RankingSignals, now: Date): number {
  return -computeRankingScore(signals, now);
}
