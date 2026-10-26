import { API_URL } from './config';

/**
 * Подтверждение и отписка по токену из письма. Публичные: токен и есть доступ,
 * входа не требуется. Повтор безопасен: сервер отвечает успехом и на уже сделанное действие.
 *
 * Возвращает `false`, если токен неизвестен (404), и бросает ошибку при сбое сети или сервера.
 */
async function postNewsletterToken(action: 'confirm' | 'unsubscribe', token: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/newsletter/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return true;
}

export function confirmNewsletter(token: string): Promise<boolean> {
  return postNewsletterToken('confirm', token);
}

export function unsubscribeNewsletter(token: string): Promise<boolean> {
  return postNewsletterToken('unsubscribe', token);
}
