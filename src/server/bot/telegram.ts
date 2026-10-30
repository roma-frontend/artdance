import 'server-only';

const TG_API = 'https://api.telegram.org';

export async function tgSendMessage(
  token: string,
  chatId: string | number,
  text: string,
  opts?: { parseMode?: string; disablePreview?: boolean },
): Promise<void> {
  const url = `${TG_API}/bot${token}/sendMessage`;
  const parseMode = opts?.parseMode ?? 'MarkdownV2';
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
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: opts?.disablePreview ?? true,
      parse_mode: parseMode,
    };
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('telegram network error');
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      // MarkdownV2 может падать на спецсимволах — фолбэк без parse_mode
      if (parseMode && t.includes('can\'t parse')) {
        const retryBody = { ...body, text: escapeMdText(chunk) };
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(retryBody),
        });
        if (retryRes.ok) continue;
        const retryText = await retryRes.text().catch(() => '');
        throw new Error(`telegram sendMessage ${retryRes.status}: ${retryText.slice(0, 500)}`);
      }
      throw new Error(`telegram sendMessage ${res.status}: ${t.slice(0, 500)}`);
    }
  }
}

/** Экранирует MarkdownV2 спецсимволы в тексте для безопасной отправки без parse_mode. */
function escapeMdText(text: string): string {
  return text.replace(/[_*[\]~#=|`()]/g, '\\$&');
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

/** Устанавливает меню команд в Telegram (появляется при нажатии на бота). */
export async function tgSetMyCommands(token: string): Promise<void> {
  const url = `${TG_API}/bot${token}/setMyCommands`;
  const commands = [
    { command: 'help', description: 'Справка по командам' },
    { command: 'status', description: 'Последние CI прогоны' },
    { command: 'repo', description: 'Инфо о репозитории' },
    { command: 'ask', description: 'Спросить AI-ассистента' },
    { command: 'task', description: 'Дать задание боту' },
  ];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`setMyCommands ${res.status}: ${t.slice(0, 500)}`);
  }
}

export function tgIsAllowed(chatId: string | number | undefined, allowed: string | undefined): boolean {
  if (!allowed) return false;
  return String(chatId) === String(allowed).trim();
}
