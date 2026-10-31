/**
 * Тест исполняет `public/push-sw.js` в песочнице с подменёнными `self`, `caches`
 * и `fetch`: скрипт без импортов и сборки, обычный `import` его не загрузит.
 * Проверяем офлайн-заглушку (A-20): что кешируется, какая локаль отдаётся и что
 * сервис-воркер не перехватывает ничего, кроме навигации.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(fileURLToPath(new URL('../../../public/push-sw.js', import.meta.url)), 'utf8');
const ORIGIN = 'https://artdance.am';

type Handler = (event: Record<string, unknown>) => void;

interface FetchRequest {
  url: string;
  mode: string;
  method: string;
}

/** Сеть, которой нет: заглушки отдаются, остальное падает — как при обрыве связи. */
function offlineNetwork(input: string | FetchRequest): Promise<Response> {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('/') && url.endsWith('/offline')) return Promise.resolve(new Response(`OFFLINE ${url}`));
  return Promise.reject(new TypeError('network down'));
}

function createWorker(network: (input: string | FetchRequest) => Promise<Response>) {
  const listeners = new Map<string, Handler>();
  const store = new Map<string, Response>();
  const caches = {
    open: async () => ({
      put: async (key: string, response: Response) => {
        store.set(key, response);
      },
      match: async (key: string) => store.get(key),
    }),
  };
  const sandbox = {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, handler: Handler) => listeners.set(type, handler),
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined, matchAll: async () => [], openWindow: async () => null },
      registration: { showNotification: async () => undefined },
    },
    caches,
    fetch: network,
    Response,
    URL,
  };
  runInNewContext(SOURCE, sandbox);
  return { listeners, store };
}

/** Отправляет событие fetch и возвращает ответ, если воркер его перехватил. */
function dispatchFetch(listeners: Map<string, Handler>, request: FetchRequest) {
  let response: Promise<Response> | undefined;
  const waits: Promise<unknown>[] = [];
  listeners.get('fetch')?.({
    request,
    respondWith: (value: Promise<Response>) => {
      response = value;
    },
    waitUntil: (value: Promise<unknown>) => {
      waits.push(value);
    },
  });
  return { response, waits };
}

async function install(listeners: Map<string, Handler>) {
  const waits: Promise<unknown>[] = [];
  listeners.get('install')?.({ waitUntil: (value: Promise<unknown>) => waits.push(value) });
  await Promise.all(waits);
}

const navigation = (path: string): FetchRequest => ({ url: `${ORIGIN}${path}`, mode: 'navigate', method: 'GET' });

describe('push-sw: офлайн-заглушка', () => {
  it('при установке кеширует заглушку каждой локали', async () => {
    const { listeners, store } = createWorker(offlineNetwork);

    await install(listeners);

    expect([...store.keys()].sort()).toEqual(['/en/offline', '/hy/offline', '/ru/offline']);
  });

  it('при сбое сети навигации отдаёт заглушку локали из адреса', async () => {
    const { listeners } = createWorker(offlineNetwork);
    await install(listeners);

    const { response } = dispatchFetch(listeners, navigation('/ru/studios'));

    expect(await (await response)?.text()).toBe('OFFLINE /ru/offline');
  });

  it('для адреса без локали отдаёт заглушку локали по умолчанию', async () => {
    const { listeners } = createWorker(offlineNetwork);
    await install(listeners);

    const { response } = dispatchFetch(listeners, navigation('/studios'));

    expect(await (await response)?.text()).toBe('OFFLINE /hy/offline');
  });

  it('при доступной сети отдаёт ответ сервера, а не заглушку', async () => {
    const network = (input: string | FetchRequest) =>
      Promise.resolve(new Response(typeof input === 'string' ? 'ASSET' : 'LIVE PAGE'));
    const { listeners } = createWorker(network);

    const { response } = dispatchFetch(listeners, navigation('/en/classes'));

    expect(await (await response)?.text()).toBe('LIVE PAGE');
  });

  it('не перехватывает запросы, кроме GET-навигации', () => {
    const { listeners } = createWorker(offlineNetwork);
    const sub = { url: `${ORIGIN}/api/booking`, mode: 'cors', method: 'GET' };
    const post = { url: `${ORIGIN}/hy/checkout`, mode: 'navigate', method: 'POST' };

    expect(dispatchFetch(listeners, sub).response).toBeUndefined();
    expect(dispatchFetch(listeners, post).response).toBeUndefined();
  });
});
