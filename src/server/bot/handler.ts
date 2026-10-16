import 'server-only';

import { getServerEnv } from '@/config/env';
import { codecraftChat } from './codecraft';
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
    '  ask <вопрос> — спросить CodeCraft (как в чате)',
    '  task <задание> — дать задание боту (через CodeCraft, как ты со мной)',
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

  // ask / task / plain text → CodeCraft
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

  // Guard: если CodeCraft не настроен — честно сказать
  const env = getServerEnv();
  if (!env.CODECRAFT_BASE_URL || !env.CODECRAFT_API_KEY) {
    return 'CodeCraft не настроен: поставь CODECRAFT_BASE_URL и CODECRAFT_API_KEY в .env.local / Vercel и redeploy.';
  }

  try {
    const answer = await codecraftChat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    });
    return answer.slice(0, 3800);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('403') || msg.includes('Just a moment') || msg.includes('challenges.cloudflare')) {
      return 'CodeCraft защищён Cloudflare (Vercel IP под челленджем). Пробую снова — если повторится, напиши провайдеру codecraftapi чтобы вынести Vercel 216.198.79.67 из Turnstile, либо дай прямой base URL без Cloudflare.';
    }
    if (msg.includes('503') || msg.includes('service_upgrading') || msg.includes('maintenance')) {
      return 'CodeCraft на техобслуживании (503 service_upgrading). Попробуй через пару минут — /status и /repo уже работают.';
    }
    return `codecraft error: ${msg.slice(0, 800)}`;
  }
}
