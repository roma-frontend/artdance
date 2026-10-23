/**
 * Адрес веб-приложения (API). Задаётся через EXPO_PUBLIC_API_URL.
 * По умолчанию — локальный dev-сервер; на телефоне localhost не работает,
 * поэтому для устройства укажите IP машины в локальной сети.
 */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
