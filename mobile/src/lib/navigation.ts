import { router, type Href } from 'expo-router';

import { deviceLocale, messagesFor } from './i18n';

/** Назад по истории; экран, открытый холодной ссылкой, уходит на запасной маршрут. */
export function goBack(fallback: Href = '/'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** Подпись кнопки «Назад» для экранного диктора на языке приложения. */
export function backLabel(): string {
  return messagesFor(deviceLocale(undefined)).catalogBack;
}
