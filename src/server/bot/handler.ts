import 'server-only';

import { getServerEnv } from '@/config/env';
import { abhibotsChat } from './abhibots';
import { ghListRuns, ghRepoInfo } from './github';

const DEFAULT_REPO = 'roma-frontend/artdance';

function repoFromEnv(): string {
  // GITHUB_TOKEN repo is fixed for now; allow override via env if needed later
  return DEFAULT_REPO;
}

function helpText(): string {
  return [
    'ArtDance bot — управление с телефона.',
    '',
    'Команды:',
    '  /help — эта справка',
    '  /status — последние CI прогоны (GitHub Actions)',
    '  /repo — инфо о репозитории',
    '  ask <вопрос> — спросить ABHIBOTS (как в чате)',
    '  task <задание> — дать задание боту (через ABHIBOTS, как ты со мной)',
    '',
    'Примеры:',
    '  ask как работает корзина Cart?',
    '  task проверь CI и удали пустые корзины',
    '  task добавь команду terminal carts stats',
    '',
    'Секреты берутся из .env.local / Vercel env — в чате не светятся.',
  ].join('\n');
}

export async function handleTelegramCommand(textRaw: string): Promise<string> {
  const text = textRaw.trim();
  const lower = text.toLowerCase();

  if (!text || lower === '/help' || lower === 'help' || lower === '/start' || lower === 'start') return helpText();

  if (lower.startsWith('/status') || lower === 'status') {
    const [owner, repo] = repoFromEnv().split('/') as [string, string];
    try {
      return await ghListRuns(owner, repo, 5);
    } catch (e) {
      return `status error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  if (lower.startsWith('/repo') || lower === 'repo') {
    const [owner, repo] = repoFromEnv().split('/') as [string, string];
    try {
      return await ghRepoInfo(owner, repo);
    } catch (e) {
      return `repo error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // ask / task / plain text → ABHIBOTS
  let prompt = text;
  let system = 'Ты — помощник разработчика ArtDance (Next.js, Prisma, Vercel). Отвечай кратко, по делу, на языке пользователя. Если просят сделать задачу — предложи план и команды.';
  if (/^(ask\s+)/i.test(text)) {
    prompt = text.replace(/^(ask\s+)/i, '');
  } else if (/^(task\s+)/i.test(text)) {
    prompt = text.replace(/^(task\s+)/i, '');
    system =
      'Ты — агент разработки ArtDance. Пользователь дал задание с телефона через Telegram-бота. ' +
      'Сформируй план выполнения: какие файлы править, какие команды запустить (typecheck/lint/test), как проверить. ' +
      'Отвечай на языке пользователя, кратко, без лишней воды. Если задание требует git/push — укажи что бот сделает пуш в main после проверок.';
  }

  // Guard: если ABHIBOTS не настроен — честно сказать
  const env = getServerEnv();
  if (!env.ABHIBOTS_BASE_URL || !env.ABHIBOTS_API_KEY) {
    return 'ABHIBOTS не настроен: поставь ABHIBOTS_BASE_URL и ABHIBOTS_API_KEY в .env.local / Vercel и redeploy.';
  }

  try {
    const answer = await abhibotsChat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    });
    return answer.slice(0, 3800);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('403') || msg.includes('Just a moment') || msg.includes('challenges.cloudflare')) {
      return 'ABHIBOTS защищён Cloudflare. Попробуй позже или проверь base URL в ABHIBOTS_BASE_URL.';
    }
    if (msg.includes('503') || msg.includes('maintenance')) {
      return 'ABHIBOTS на техобслуживании (503). Попробуй через пару минут — /status и /repo уже работают.';
    }
    return `abhibots error: ${msg.slice(0, 800)}`;
  }
}
