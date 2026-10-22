'use client';

/**
 * ONBOARDING TOUR — анкета танцора.
 *
 * Один компонент обслуживает и первый тур после регистрации, и правку анкеты
 * в кабинете: разница только в том, куда человек возвращается после сохранения.
 * Вторая копия этого экрана разошлась бы с первой на первом же переводе.
 *
 * **Уровень обязателен, стили и цель — нет.** Кнопка «Далее» на первом шаге
 * заблокирована, пока уровень не выбран; на остальных шагах «Пропустить» есть,
 * и тур не должен превращаться в анкету ради анкеты.
 *
 * **Ответы сохраняются на каждом шаге.** Человек, у которого на втором шаге
 * отвалился интернет, не теряет первый ответ — он вернётся по тому же адресу
 * и продолжит с того места, где остановился.
 *
 * **Движение — transform и opacity.** Смена шага уезжает вбок и поднимается,
 * карточки ответа появляются волной. При `prefers-reduced-motion` переходы
 * отключаются: человек, попросивший об уменьшении движения, получает
 * мгновенную смену шага, а не «то же самое, но быстрее».
 */

import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { AnimatePresence, motion, useReducedMotion, type Easing } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { routes } from '@/config';
import { motion as designMotion } from '@/design/motion';
import { danceStyleLabelKey, dancerLevelLabelKey, type DanceStyle, type DancerLevel } from '@/domain/enums';
import { useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { saveDancerProfileAction } from '@/server/actions/dancer-profile';

const tour = designMotion.onboarding;
const ease = tour.ease as unknown as Easing;

/** Три шага: уровень → направления → цель. */
const STEPS = ['level', 'styles', 'goal'] as const;
type Step = (typeof STEPS)[number];

interface Answers {
  level: DancerLevel | null;
  styles: DanceStyle[];
  goal: string;
  note: string;
}

interface DancerTourProps {
  initialLevel?: DancerLevel | null;
  initialStyles?: readonly DanceStyle[];
  initialGoal?: string | null;
  initialNote?: string | null;
  /**
   * `onboarding` — первый тур, после сохранения человек попадает в кабинет.
   * `edit` — правка анкеты, после сохранения остаёмся на странице.
   */
  mode: 'onboarding' | 'edit';
}

export function DancerTour({
  initialLevel = null,
  initialStyles = [],
  initialGoal = null,
  initialNote = null,
  mode,
}: DancerTourProps) {
  const t = useTranslations('onboarding.dancer');
  const tRoot = useTranslations();
  const router = useRouter();
  const reduce = useReducedMotion();

  const [step, setStep] = useState<Step>('level');
  const [answers, setAnswers] = useState<Answers>({
    level: initialLevel,
    styles: [...initialStyles],
    goal: initialGoal ?? '',
    note: initialNote ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  // колбэки — у хука, а не у `execute`: иначе второй аргумент `execute`
  // пришлось бы кастить через `as unknown`, а шаг тура — отслеживать вне хука
  const mid = useAction(saveDancerProfileAction, {
    onSuccess: () => {
      const next = STEPS[STEPS.indexOf(step) + 1];
      if (next) setStep(next as Step);
    },
    onError: () => setError(tRoot('errors.generic.description')),
  });
  const fin = useAction(saveDancerProfileAction, {
    onSuccess: () => {
      if (mode === 'onboarding') router.push(routes.account());
      else router.refresh();
    },
    onError: () => setError(tRoot('errors.generic.description')),
  });

  const isSaving = mid.status === 'executing' || fin.status === 'executing';
  const stepIndex = STEPS.indexOf(step);
  const canAdvance = step !== 'level' || answers.level !== null;

  function update(patch: Partial<Answers>) {
    setAnswers((prev) => ({ ...prev, ...patch }));
  }

  function toggleStyle(style: DanceStyle) {
    setAnswers((prev) => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((item) => item !== style)
        : [...prev.styles, style],
    }));
  }

  function requireLevel(): boolean {
    if (answers.level) return true;
    setError(tRoot('validation.required'));
    return false;
  }

  function saveMid() {
    if (!requireLevel() || isSaving) return;
    setError(null);
    mid.execute({
      level: answers.level!,
      styles: answers.styles,
      goal: answers.goal,
      note: answers.note,
      // в режиме правки анкета уже засчитана — сбрасывать «тур пройден» нельзя,
      // иначе человек снова окажется в туре после каждой правки
      completed: mode === 'edit',
    });
  }

  function saveFinish() {
    if (!requireLevel() || isSaving) return;
    setError(null);
    fin.execute({
      level: answers.level!,
      styles: answers.styles,
      goal: answers.goal,
      note: answers.note,
      completed: true,
    });
  }

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-eyebrow uppercase text-content-tertiary">
            {t('step', { current: stepIndex + 1, total: STEPS.length })}
          </p>
          <p className="text-caption text-content-tertiary">{t('progressLabel')}</p>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={stepIndex + 1}
          aria-label={t('progressLabel')}
        >
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.45, ease }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: tour.step.xPx, y: tour.step.yPx }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -tour.step.xPx, y: -tour.step.yPx }}
          transition={
            reduce
              ? ({ duration: 0 } as unknown as Record<string, unknown>)
              : ({ duration: tour.step.enterMs / 1000, ease } as unknown as Record<string, unknown>)
          }
        >
          {step === 'level' ? (
            <LevelStep answers={answers} onSelect={(level) => update({ level })} reduce={Boolean(reduce)} />
          ) : null}
          {step === 'styles' ? (
            <StylesStep answers={answers} onToggle={toggleStyle} reduce={Boolean(reduce)} />
          ) : null}
          {step === 'goal' ? <GoalStep answers={answers} onChange={update} /> : null}
        </motion.div>
      </AnimatePresence>

      {error ? (
        <p role="alert" className="text-body-sm mt-4 font-semibold text-content-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        {stepIndex > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep(STEPS[stepIndex - 1] as Step)}>
            <ArrowLeft className="size-4" aria-hidden />
            {t('back')}
          </Button>
        ) : (
          <span />
        )}

        {step === 'goal' ? (
          <Button type="button" variant="accent" size="lg" onClick={saveFinish} disabled={isSaving}>
            {isSaving ? t('saving') : t('finish')}
            <Check className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" variant="accent" size="lg" onClick={saveMid} disabled={!canAdvance || isSaving}>
            {isSaving ? t('saving') : t('next')}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Шаг 1: уровень ─────────────────────────── */

function LevelStep({
  answers,
  onSelect,
  reduce,
}: {
  answers: Answers;
  onSelect: (level: DancerLevel) => void;
  reduce: boolean;
}) {
  const t = useTranslations('onboarding.dancer.level');
  const tRoot = useTranslations();

  const items: readonly { level: DancerLevel; key: 'beginner' | 'intermediate' | 'advanced' }[] = [
    { level: 'BEGINNER', key: 'beginner' },
    { level: 'INTERMEDIATE', key: 'intermediate' },
    { level: 'ADVANCED', key: 'advanced' },
  ];

  return (
    <section aria-labelledby="tour-level-title">
      <h1 id="tour-level-title" className="text-heading-2">
        {t('title')}
      </h1>
      <p className="text-body mt-2 text-content-secondary">{t('hint')}</p>

      <motion.ul
        className="mt-6 grid gap-3"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduce ? 0 : tour.staggerMs / 1000 } },
        }}
      >
        {items.map(({ level, key }) => {
          const selected = answers.level === level;
          return (
            <motion.li
              key={level}
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.34, ease } },
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(level)}
                aria-pressed={selected}
                className={cn(
                  'w-full rounded-2xl border p-5 text-start transition-colors duration-normal ease-brand',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
                  selected
                    ? 'border-accent bg-accent-soft shadow-md shadow-accent/15'
                    : 'border-border-default bg-surface-card hover:border-border-strong',
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-card-title text-content-primary">
                    {tRoot(dancerLevelLabelKey(level))}
                  </span>
                  {selected ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-content-on-accent">
                      <Check className="size-4" aria-hidden />
                    </span>
                  ) : null}
                </span>
                <span className="text-body-sm mt-1 block text-content-secondary">
                  {t(`${key}.description`)}
                </span>
              </button>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}

/* ───────────────────────── Шаг 2: направления ───────────────────────── */

function StylesStep({
  answers,
  onToggle,
  reduce,
}: {
  answers: Answers;
  onToggle: (style: DanceStyle) => void;
  reduce: boolean;
}) {
  const t = useTranslations('onboarding.dancer.styles');
  const tRoot = useTranslations();

  const styles: readonly DanceStyle[] = [
    'HIP_HOP',
    'SALSA',
    'BACHATA',
    'LATIN',
    'BALLET',
    'CONTEMPORARY',
    'JAZZ',
    'HEELS',
    'KPOP',
    'BREAKING',
    'AFRO',
    'FLAMENCO',
    'ARMENIAN_FOLK',
    'BALLROOM',
    'TANGO',
    'WEDDING_DANCE',
    'KIDS',
    'STRETCHING',
  ];

  return (
    <section aria-labelledby="tour-styles-title">
      <h1 id="tour-styles-title" className="text-heading-2">
        {t('title')}
      </h1>
      <p className="text-body mt-2 text-content-secondary">{t('hint')}</p>
      <p className="text-caption mt-1 text-content-tertiary">{t('optional')}</p>

      <motion.ul
        className="mt-6 flex flex-wrap gap-2"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduce ? 0 : 0.018 } },
        }}
      >
        {styles.map((style) => {
          const selected = answers.styles.includes(style);
          return (
            <motion.li
              key={style}
              variants={{
                hidden: { opacity: 0, scale: reduce ? 1 : 0.94 },
                show: { opacity: 1, scale: 1, transition: { duration: 0.22, ease } },
              }}
            >
              <button
                type="button"
                onClick={() => onToggle(style)}
                aria-pressed={selected}
                className={cn(
                  'rounded-full border px-4 py-2 text-body-sm font-semibold transition-colors duration-normal ease-brand',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
                  selected
                    ? 'border-accent bg-accent text-content-on-accent'
                    : 'border-border-default bg-surface-card text-content-secondary hover:border-border-strong hover:text-content-primary',
                )}
              >
                {tRoot(danceStyleLabelKey(style))}
              </button>
            </motion.li>
          );
        })}
      </motion.ul>

      {answers.styles.length > 0 ? (
        <p className="text-caption mt-4 text-content-tertiary">
          {t('selected', { count: answers.styles.length })}
        </p>
      ) : null}
    </section>
  );
}

/* ─────────────────────────── Шаг 3: цель ─────────────────────────── */

function GoalStep({
  answers,
  onChange,
}: {
  answers: Answers;
  onChange: (patch: Partial<Answers>) => void;
}) {
  const t = useTranslations('onboarding.dancer.goal');

  return (
    <section aria-labelledby="tour-goal-title">
      <h1 id="tour-goal-title" className="text-heading-2">
        {t('title')}
      </h1>
      <p className="text-body mt-2 text-content-secondary">{t('hint')}</p>
      <p className="text-caption mt-1 text-content-tertiary">{t('optional')}</p>

      <div className="mt-6 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="tour-goal" className="text-label uppercase text-content-secondary">
            {t('goalLabel')}
          </label>
          <textarea
            id="tour-goal"
            name="goal"
            rows={3}
            maxLength={500}
            value={answers.goal}
            onChange={(event) => onChange({ goal: event.target.value })}
            placeholder={t('goalPlaceholder')}
            className="form-input min-h-24 resize-y"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="tour-note" className="text-label uppercase text-content-secondary">
            {t('noteLabel')}
          </label>
          <textarea
            id="tour-note"
            name="note"
            rows={3}
            maxLength={500}
            value={answers.note}
            onChange={(event) => onChange({ note: event.target.value })}
            placeholder={t('notePlaceholder')}
            className="form-input min-h-24 resize-y"
          />
        </div>
      </div>

      <p className="text-caption mt-4 flex items-start gap-2 text-content-tertiary">
        <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('visibleToInstructor')}
      </p>
    </section>
  );
}
