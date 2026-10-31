/**
 * PWA REGISTER — регистрирует service worker сайта на каждой странице (A-20).
 *
 * Тот же файл даёт Web Push (C-07), но раньше регистрировался только при включении
 * уведомлений. Без регистрации на старте офлайн-заглушка `/offline` не кешируется,
 * и браузер не предлагает установку на домашний экран.
 *
 * Компонент ничего не рендерит: это побочный эффект, а не разметка.
 */

'use client';

import { useEffect } from 'react';

const SW_PATH = '/push-sw.js';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Регистрация повторно с тем же файлом — no-op, поэтому эффект можно не ограничивать.
    navigator.serviceWorker.register(SW_PATH).catch(() => {
      // Приватный режим или небезопасный контекст: сайт работает и без офлайн-заглушки.
    });
  }, []);

  return null;
}
