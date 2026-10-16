import 'server-only';

const TG_API = 'https://api.telegram.org';

export async function tgSendMessage(token: string, chatId: string | number, text: string, opts?: { parseMode?: string; disablePreview?: boolean }): Promise<void> {
  const url = `${TG_API}/bot${token}/sendMessage`;
  // Telegram лимит 4096 символов на сообщение — режем
  const chunkSize = 3900;
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > chunkSize) {
    let slice = remaining.slice(0, chunkSize);
    const lastNl = slice.lastIndexOf('\n');
    if (lastNl > 2000) slice = slice.slice(0, lastNl);
    chunks.push(slice);
    remaining = remaining.slice(slice.length);
  }
  chunks.push(remaining);
  for (const chunk of chunks) {
    const body: Record<string, unknown> = { chat_id: chatId, text: chunk, disable_web_page_preview: opts?.disablePreview ?? true };
    if (opts?.parseMode) body.parse_mode = opts.parseMode;
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`telegram sendMessage ${res.status}: ${t.slice(0, 500)}`);
    }
  }
}

export async function tgSetWebhook(token: string, webhookUrl: string, secret: string): Promise<unknown> {
  const url = `${TG_API}/bot${token}/setWebhook`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ['message'] }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.ok !== true) throw new Error(`setWebhook failed: ${JSON.stringify(j).slice(0, 800)}`);
  return j;
}

export function tgIsAllowed(chatId: string | number | undefined, allowed: string | undefined): boolean {
  if (!allowed) return false;
  return String(chatId) === String(allowed).trim();
}
