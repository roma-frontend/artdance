'use client';

/**
 * TURNSTILE — виджет капчи Cloudflare.
 *
 * Написан руками, без пакета-обёртки: библиотека для вставки одного скрипта и
 * одного `div` — это зависимость, которая обновляется чаще, чем сам виджет.
 * Проект намеренно тонкий (`webhook.ts`, `rate-limit.ts` тоже без SDK).
 *
 * Ключевое решение: **без ключа сайта виджет не рендерится вовсе, и форма
 * остаётся рабочей.** Серверная проверка при отсутствии секрета пропускает
 * запрос (`verifyTurnstile`), поэтому формы можно писать и тестировать до
 * получения ключей Cloudflare — и в коде не остаётся закомментированных
 * вызовов. Как только ключи появятся в окружении, защита включится сама.
 *
 * Тема виджета следует теме сайта, а не системной: капча на светлой плашке в
 * тёмном интерфейсе — единственное белое пятно на экране.
 */

import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';

import { clientEnv } from '@/config/env';

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: 'light' | 'dark' | 'auto';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Загрузка скрипта один раз на приложение, сколько бы форм ни было на странице. */
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener('load', () => resolve(), { once: true }));
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    document.head.append(script);
  });
}

interface TurnstileFieldProps {
  /** Вызывается с токеном; `null` означает «истёк» или «ошибка». */
  onToken: (token: string | null) => void;
}

export function TurnstileField({ onToken }: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const siteKey = clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  /**
   * Колбэк в ref, а не в зависимостях эффекта: иначе виджет пересоздавался бы на
   * каждый рендер формы, и пользователь решал бы капчу заново после ввода буквы.
   * Синхронизация именно в эффекте — запись в ref во время рендера запрещена
   * правилом `react-hooks/refs`, и запрещена справедливо: рендер обязан быть
   * чистым.
   */
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;

    let widgetId: string | undefined;
    let cancelled = false;

    void loadScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: resolvedTheme === 'dark' ? 'dark' : 'light',
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => onTokenRef.current(null),
      });
    });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, resolvedTheme]);

  if (!siteKey) return null;

  /*
   * Место под виджет резервируется заранее: он приезжает асинхронно, и без
   * минимальной высоты кнопка отправки подпрыгивает под пальцем в момент
   * загрузки. Высота — под стандартный виджет Cloudflare (около 65px).
   */
  return <div ref={containerRef} className="min-h-17" />;
}
