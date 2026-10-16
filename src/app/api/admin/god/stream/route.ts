import { requireOperator } from '@/lib/auth/guards';
import { getGodPulse } from '@/server/admin/god';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GOD SSE — живые обновления для Command Center.
 *
 * Держит одно соединение и пушит `pulse` каждые 8s + `hello` при коннекте.
 * Клиент реконнектится через EventSource, сервер проверяет allowlist при
 * установке соединения (cookie session). Дешевле и плавнее polling.
 */
export async function GET() {
  try {
    await requireOperator();
  } catch {
    return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // hello immediately
      try {
        const pulse = await getGodPulse();
        send('hello', { timestamp: new Date().toISOString() });
        send('pulse', pulse);
      } catch {}

      const interval = setInterval(async () => {
        try {
          const pulse = await getGodPulse();
          send('pulse', pulse);
        } catch {}
      }, 8000);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {}
      }, 25000);

      // cleanup when client disconnects — Next.js closes the stream
      const cleanup = () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      };

      // Node/Next signals abort via controller; best-effort timeout at 5 min to recycle
      setTimeout(cleanup, 5 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
