import 'server-only';

import { getServerEnv } from '@/config/env';
import { translateForSnapshot } from '@/i18n/snapshot';
import { abhibotsChat } from './abhibots';
import { ghListRuns, ghRepoInfo } from './github';

const DEFAULT_REPO = 'roma-frontend/artdance';
const LOCALE = 'ru' as const;

function repoFromEnv(): string {
  return DEFAULT_REPO;
}

/** Обрезка ответа по абзацу, чтобы не рвать markdown-форматирование. */
function truncateByParagraph(text: string, maxLen = 3800): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastPara = cut.lastIndexOf('\n\n');
  if (lastPara > maxLen * 0.5) return cut.slice(0, lastPara) + '\n…';
  return cut + '…';
}

function helpText(): string {
  const t = translateForSnapshot;
  return [
    t(LOCALE, 'bot.help.title'),
    '',
    t(LOCALE, 'bot.help.commands'),
    '',
    t(LOCALE, 'bot.help.examples'),
    '',
    t(LOCALE, 'bot.help.footer'),
  ].join('\n');
}

function formatStatus(runs: string): string {
  const title = translateForSnapshot(LOCALE, 'bot.status.title');
  if (!runs || runs === 'no runs') {
    return `${title}\n\n${translateForSnapshot(LOCALE, 'bot.status.empty')}`;
  }
  // Украсить каждую строку CI-прогонов
  const lines = runs.split('\n').map((line) => {
    if (/\bpending\b/i.test(line)) return `⏳ ${line}`;
    if (/\bin_progress\b/i.test(line)) return `🔄 ${line}`;
    if (/\bfailed\b/i.test(line)) return `❌ ${line}`;
    if (/\bcancelled\b/i.test(line)) return `🚫 ${line}`;
    if (/\bsuccess\b/i.test(line) || /\bcompleted\b/i.test(line)) return `✅ ${line}`;
    return `• ${line}`;
  });
  return [title, '', lines.join('\n')].join('\n');
}

function formatRepo(info: string): string {
  const title = translateForSnapshot(LOCALE, 'bot.repo.title');
  return [title, '', info].join('\n');
}

export async function handleTelegramCommand(textRaw: string): Promise<string> {
  const text = textRaw.trim();
  const lower = text.toLowerCase();

  if (!text || lower === '/help' || lower === 'help' || lower === '/start' || lower === 'start') {
    return helpText();
  }

  if (lower.startsWith('/status') || lower === 'status') {
    const [owner, repo] = repoFromEnv().split('/') as [string, string];
    try {
      const runs = await ghListRuns(owner, repo, 5);
      return formatStatus(runs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `${translateForSnapshot(LOCALE, 'bot.generalError')}\n\n${msg.slice(0, 500)}`;
    }
  }

  if (lower.startsWith('/repo') || lower === 'repo') {
    const [owner, repo] = repoFromEnv().split('/') as [string, string];
    try {
      const info = await ghRepoInfo(owner, repo);
      return formatRepo(info);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `${translateForSnapshot(LOCALE, 'bot.generalError')}\n\n${msg.slice(0, 500)}`;
    }
  }

  // Авто-роутинг: если в сообщении про CI/GitHub/репо — не отправляем в AI, а вызываем GitHub API
  // (без завершающего \b — русские падежи: «репозиторию», «репозитория», «репозитории»)
  const hasCiKeywords = /\b(ci|прогон|github actions|пайплайн)\b/i.test(lower);
  const hasRepoKeywords = /(^|\s|\/)(репо|репозитори|repo|github|gh|artdance|art dance)/i.test(lower);
  if (hasCiKeywords || hasRepoKeywords) {
    const [owner, repo] = repoFromEnv().split('/') as [string, string];
    const parts: string[] = [];
    if (hasRepoKeywords) {
      try {
        parts.push(formatRepo(await ghRepoInfo(owner, repo)));
      } catch (e) {
        parts.push(`${translateForSnapshot(LOCALE, 'bot.generalError')} (repo): ${e instanceof Error ? e.message : String(e)}`.slice(0, 500));
      }
    }
    if (hasCiKeywords) {
      try {
        parts.push(formatStatus(await ghListRuns(owner, repo, 5)));
      } catch (e) {
        parts.push(`${translateForSnapshot(LOCALE, 'bot.generalError')} (CI): ${e instanceof Error ? e.message : String(e)}`.slice(0, 500));
      }
    }
    return parts.join('\n\n') || 'GitHub недоступен.';
  }

  // ask / task / plain text → ABHIBOTS
  let prompt = text;
  let isTask = false;
  const askMatch = /^(\/?ask\s+)/i.exec(text);
  const taskMatch = /^(\/?task\s+)/i.exec(text);
  if (askMatch) {
    prompt = text.replace(/^(\/?ask\s+)/i, '');
  } else if (taskMatch) {
    prompt = text.replace(/^(\/?task\s+)/i, '');
    isTask = true;
  }

  let system: string;
  const projectContext =
    'Контекст проекта ArtDance:\n' +
    '- Next.js (App Router) + TypeScript, Prisma, Vercel\n' +
    '- Репозиторий: github.com/roma-frontend/artdance\n' +
    '- Бот имеет доступ к GitHub API (может показать /status и /repo)\n' +
    '- Имя бота: ArtDance Bot — ты НЕ обычный Claude, ты специализированный ассистент проекта ArtDance\n' +
    '- Когда спрашивают «что ты можешь» — перечисли конкретные команды бота (/status, /repo, /ask, /task), а не общие AI-возможности';
  if (isTask) {
    system =
      projectContext +
      '\n\nЗадание от пользователя (через Telegram):\n' +
      'Сформируй план выполнения: какие файлы править, какие команды запустить (typecheck/lint/test), как проверить. ' +
      'Отвечай на языке пользователя, кратко, без лишней воды. Если задание требует git/push — укажи что бот сделает пуш в main после проверок.';
  } else {
    system =
      projectContext +
      '\n\nПользователь задаёт вопрос через Telegram-бота. Отвечай как бот ArtDance, а не как generic Claude. Кратко, по делу, на языке пользователя.';
  }

  // Guard
  const env = getServerEnv();
  if (!env.ABHIBOTS_BASE_URL || !env.ABHIBOTS_API_KEY) {
    return translateForSnapshot(LOCALE, isTask ? 'bot.task.notConfigured' : 'bot.ask.notConfigured');
  }

  try {
    const answer = await abhibotsChat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    });
    return truncateByParagraph(answer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('403') || msg.includes('Just a moment') || msg.includes('challenges.cloudflare')) {
      return '⚠️ ABHIBOTS защищён Cloudflare (Vercel IP под челленджем). Попробуй позже или проверь ABHIBOTS_BASE_URL.';
    }
    if (msg.includes('503') || msg.includes('service_upgrading') || msg.includes('maintenance')) {
      return '⏳ ABHIBOTS на техобслуживании (503). Попробуй через пару минут — /status и /repo уже работают.';
    }
    const label = translateForSnapshot(LOCALE, isTask ? 'bot.task.error' : 'bot.ask.error');
    return `${label}\n\n\`${msg.slice(0, 800)}\``;
  }
}
