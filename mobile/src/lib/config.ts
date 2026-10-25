/**
 * Адрес веб-приложения (API). Задаётся через EXPO_PUBLIC_API_URL.
 * Для локальной разработки укажите IP машины в локальной сети в mobile/.env.
 */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'https://artdance.am';
