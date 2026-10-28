import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { fetchR2Object } from './fetch-r2-object.ts';

const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function serve(listener: RequestListener): Promise<string> {
  const server = createServer(listener);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/object.webp`;
}

describe('fetchR2Object', () => {
  it('повторяет запрос, если первая попытка зависла дольше таймаута', async () => {
    let requests = 0;
    const url = await serve((_request, response) => {
      requests += 1;
      if (requests === 1) return;
      response.end('payload');
    });

    const data = await fetchR2Object(url, 'object.webp', { timeoutMs: 500, backoffMs: 1 });

    expect(data.toString()).toBe('payload');
    expect(requests).toBe(2);
  });

  it('называет объект в ошибке, когда все попытки неудачны', async () => {
    const url = await serve((_request, response) => {
      response.statusCode = 503;
      response.end();
    });

    await expect(fetchR2Object(url, 'object.webp', { attempts: 2, backoffMs: 1 })).rejects.toThrow(
      'R2 GET object.webp failed after 2 attempts',
    );
  });
});
