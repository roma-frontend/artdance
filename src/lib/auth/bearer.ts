/**
 * Признак нативного запроса: `Authorization: Bearer <token>`.
 *
 * Браузер не добавляет `Authorization` к cross-site запросу без CORS-preflight, а
 * чужой сайт не может подложить этот заголовок. Значит, bearer-запрос не может быть
 * CSRF-запросом, и проверка `Origin` для него не нужна. Expo присылает `Origin`
 * вида `exp://...` или адрес Metro, поэтому его нельзя сравнивать с `trustedOrigins`.
 */
export function isBearerRequest(request: Request): boolean {
  return /^Bearer\s+\S/i.test(request.headers.get('authorization') ?? '');
}
