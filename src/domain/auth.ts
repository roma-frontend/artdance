/**
 * СХЕМЫ ФОРМ АУТЕНТИФИКАЦИИ.
 *
 * Одна схема на форму, и она же — на сервере. Вторая копия правил в браузере
 * означала бы, что пароль из восьми символов проходит клиентскую проверку и
 * отклоняется серверной (или, что хуже, наоборот).
 *
 * **Тексты ошибок здесь не задаются.** Zod получает код (`validation.minLength`),
 * а не фразу: одна схема обслуживает три языка, и «Password too short» на
 * армянской странице — это не мелочь, а единственная английская строка на экране.
 * Ключ приходит в `message`, компонент формы отдаёт его в `t()`.
 *
 * **Требования к паролю — из `security.password`.** Их видят трое: схема, текст
 * подсказки под полем и сервер аутентификации (`emailAndPassword.minPasswordLength`).
 * Разойдись они — человек получит отказ без объяснения, что именно не так.
 */

import { z } from 'zod';

import { security } from '@/config/business';
import { limits } from '@/config/business';

/** Адрес: обрезаем пробелы и приводим к нижнему регистру до всех проверок. */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'validation.required')
  .email('validation.email');

/**
 * Пароль при входе проверяется только на непустоту.
 *
 * Требования к длине и составу применяются при регистрации и смене. На входе они
 * вредны: человек с паролем, заданным до ужесточения правил, получил бы отказ на
 * своём настоящем пароле — и решил бы, что забыл его. Правильность проверяет
 * сервер сравнением с хешем.
 */
const currentPassword = z.string().min(1, 'validation.required');

/**
 * Новый пароль.
 *
 * Верхняя граница не менее важна нижней: без неё поле пароля становится способом
 * заставить сервер считать хеш от мегабайта текста на каждый запрос.
 */
const newPassword = z
  .string()
  .min(security.password.minLength, 'validation.passwordTooShort')
  .max(security.password.maxLength, 'validation.maxLength')
  .refine(
    (value) => !security.password.requireNumber || /\d/.test(value),
    'validation.passwordNeedsNumber',
  )
  .refine(
    (value) => !security.password.requireUppercase || /[A-ZА-ЯԱ-Ֆ]/.test(value),
    'validation.required',
  );

/**
 * Код отказа «аккаунт заблокирован после серии неудачных входов».
 *
 * Контракт между тремя участниками: хук в `lib/auth/auth.ts` его бросает,
 * действие входа превращает в переводимое сообщение, `npm run verify:auth`
 * проверяет, что прямой запрос к `/api/auth/sign-in/email` тоже упирается в
 * блокировку. Живёт в домене, а не рядом с реализацией: реализация помечена
 * `server-only` и из скрипта проверки не импортируется.
 *
 * Отдельно от `errorCodes`: тот список — словарь ошибок нашего API, а это код
 * внутри тела ошибки библиотеки.
 */
export const lockoutErrorCode = 'ACCOUNT_LOCKED';

export const signInSchema = z.object({
  email,
  password: currentPassword,
  /** Токен капчи. `null` — виджет не показан (ключи не настроены). */
  captchaToken: z.string().nullish(),
  /**
   * Куда вернуть после входа. Только относительный путь: абсолютный URL в этом
   * параметре — это открытый редирект, то есть готовая фишинговая ссылка с нашего
   * домена. Проверка формы, а не только компонента: параметр приходит из адресной
   * строки.
   */
  redirectTo: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || (value.startsWith('/') && !value.startsWith('//')),
      'validation.required',
    ),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(limits.text.nameMax, 'validation.maxLength'),
  email,
  password: newPassword,
  /**
   * Согласие с условиями — обязательное поле, а не галочка «по умолчанию
   * включено»: предвыбранное согласие не является согласием ни по GDPR, ни по ЗРА.
   */
  acceptTerms: z.literal(true, { message: 'validation.termsRequired' }),
  captchaToken: z.string().nullish(),
  redirectTo: signInSchema.shape.redirectTo,
});

export const forgotPasswordSchema = z.object({
  email,
  captchaToken: z.string().nullish(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'validation.required'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'validation.required'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'validation.passwordsDoNotMatch',
    path: ['confirmPassword'],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Требования к паролю для показа человеку.
 *
 * Отдаются одним объектом, чтобы подсказка под полем строилась из тех же чисел,
 * что и проверка. Список требований словами — в i18n; здесь только значения.
 */
export const passwordRequirements = {
  minLength: security.password.minLength,
  requireNumber: security.password.requireNumber,
  requireUppercase: security.password.requireUppercase,
} as const;
