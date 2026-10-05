'use client';

import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { firstLessonTopics } from '@/config';

const SWITCH_STAGGER_MS = 180;

export function FirstLessonTips() {
  const t = useTranslations('home.journey.firstLesson');
  const [openTopic, setOpenTopic] = useState<(typeof firstLessonTopics)[number] | null>(null);
  const switchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (switchTimerRef.current !== null) window.clearTimeout(switchTimerRef.current);
    };
  }, []);

  const handleSelect = useCallback(
    (topic: (typeof firstLessonTopics)[number], isOpen: boolean) => {
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
        switchTimerRef.current = null;
      }

      // закрыть текущий
      if (isOpen) {
        setOpenTopic(null);
        return;
      }

      // первый клик — сразу
      if (openTopic === null) {
        setOpenTopic(topic);
        return;
      }

      // переключение: закрываем текущий, открываем новый со стаггером
      // чтобы две анимации высоты не бежали одновременно и не давали рывок
      const prefersReducedMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        setOpenTopic(topic);
        return;
      }

      setOpenTopic(null);
      switchTimerRef.current = window.setTimeout(() => {
        switchTimerRef.current = null;
        setOpenTopic(topic);
      }, SWITCH_STAGGER_MS);
    },
    [openTopic],
  );

  return (
    <>
      <h3 className="text-heading-3">{t('title')}</h3>
      <p className="text-body-sm mt-2 text-content-secondary">{t('subtitle')}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3 items-start">
        {firstLessonTopics.map((topic) => {
          const isOpen = openTopic === topic;
          return (
            <details
              key={topic}
              open={isOpen}
              className="first-lesson-tip group self-start rounded-xl border border-border-default bg-surface-card p-4"
              data-open={isOpen ? 'true' : 'false'}
            >
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  handleSelect(topic, isOpen);
                }}
                className="text-body-sm flex cursor-pointer list-none items-start justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden"
              >
                <span>{t(`${topic}.question`)}</span>
                <PlusIcon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-content-tertiary transition-transform duration-300 ease-brand group-data-[open=true]:rotate-45"
                />
              </summary>
              <div className="first-lesson-body" aria-hidden={!isOpen}>
                <div className="first-lesson-body-inner">
                  <p className="text-body-sm mt-3 text-content-secondary">{t(`${topic}.answer`)}</p>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
