/**
 * ЧЕРНОВИК ОФОРМЛЕНИЯ — то, что человек уже ввёл, но ещё не купил.
 *
 * Шаги оформления живут в URL (`checkoutSteps` в `config/routes.ts`), поэтому
 * каждый переход — новая страница и новый экземпляр состояния. Без черновика
 * имя, введённое на первом шаге, приходилось бы вводить заново на последнем —
 * и кнопка «Оплатить» отправляла бы заказ без контактов.
 *
 * Почему `sessionStorage`, а не сервер: черновик содержит персональные данные
 * (адрес, телефон), но ещё не является заказом, и держать его в БД значило бы
 * завести таблицу брошенных корзин с адресами гостей. `sessionStorage`
 * исчезает вместе с вкладкой — ровно тот срок, который нужен.
 *
 * Почему не zustand: черновик читает только экран оформления, а подписка на
 * изменения между шагами не нужна — экран перемонтируется на каждом шаге.
 * Модуль остаётся обычным объектом и не тянет хранилище в бандл шапки.
 *
 * Никаких секретов здесь нет и быть не может: номер карты не сохраняется —
 * он уходит провайдеру, а не в localStorage. Функция `setDraft` вырезает
 * карточные поля, даже если вызывающий их передал.
 */

import type { PaymentMethod } from '@/domain/enums';

const STORAGE_KEY = 'ARTDANCE_CHECKOUT_DRAFT';

/** Поля, которые черновику запрещены: реквизиты карты не покидают форму. */
const FORBIDDEN_KEY = /card|cvv|expiry|cardholder/i;

export interface CheckoutDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  notes: string;
  deliveryMethod: 'courier' | 'pickup' | null;
  paymentMethod: PaymentMethod | null;
}

function emptyDraft(): CheckoutDraft {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    notes: '',
    deliveryMethod: null,
    paymentMethod: null,
  };
}

/**
 * Читает черновик. Никогда не бросает: испорченная запись (другая версия
 * формата, ручная правка) означает «черновика нет», а не белый экран
 * оформления.
 */
export function readDraft(): CheckoutDraft {
  const empty = emptyDraft();
  if (typeof window === 'undefined') return empty;

  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Приватный режим или отключённое хранилище — работаем без черновика.
    return empty;
  }
  if (!raw) return empty;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const text = (key: string): string => (typeof parsed?.[key] === 'string' ? (parsed[key] as string) : '');
    const delivery = parsed?.deliveryMethod;

    return {
      firstName: text('firstName'),
      lastName: text('lastName'),
      email: text('email'),
      phone: text('phone'),
      address: text('address'),
      city: text('city'),
      postalCode: text('postalCode'),
      notes: text('notes'),
      deliveryMethod: delivery === 'courier' || delivery === 'pickup' ? delivery : null,
      paymentMethod: typeof parsed?.paymentMethod === 'string' ? (parsed.paymentMethod as PaymentMethod) : null,
    };
  } catch {
    return empty;
  }
}

/** Дописывает поля. Карточные ключи вырезаются до записи, а не после. */
export function writeDraft(patch: Partial<CheckoutDraft>): void {
  if (typeof window === 'undefined') return;

  const safe: Partial<CheckoutDraft> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    (safe as Record<string, unknown>)[key] = value;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readDraft(), ...safe }));
  } catch {
    // Хранилище переполнено или запрещено — оформление не должно на этом встать.
  }
}

/** Заказ создан — черновик больше не нужен. */
export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // см. `writeDraft`
  }
}

/** Контактное имя для `Order.contactName` собирается из двух полей формы. */
export function draftContactName(draft: Pick<CheckoutDraft, 'firstName' | 'lastName'>): string {
  return `${draft.firstName} ${draft.lastName}`.trim();
}
