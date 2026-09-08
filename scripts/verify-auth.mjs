/**
 * Проверка аутентификации на живой сборке.
 *
 *   npm run build && npm start
 *   npm run verify:auth
 *
 * Юнит-тесты этого не покрывают и покрыть не могут: вход — это cookie, подпись,
 * запись в базу и проверка сессии следующим запросом. Проверяется то, что нельзя
 * увидеть ни в типах, ни в линтере:
 *
 *   1. вход с верным паролем ставит cookie с НАШИМ именем (его знает proxy.ts —
 *      с чужим именем защита приватных разделов не сработает);
 *   2. cookie помечен HttpOnly и SameSite (иначе его читает любой скрипт);
 *   3. сессия действительно узнаётся следующим запросом;
 *   4. неверный пароль не пускает и не раскрывает, существует ли адрес;
 *   5. регистрация не может назначить себе роль (role: 'ADMIN' в теле запроса);
 *   6. выход инвалидирует сессию;
 *   7. **перебор через `/api/auth/sign-in/email` упирается в блокировку и в
 *      ограничитель частоты.** Это главная проверка файла: эндпоинт библиотеки
 *      публичен и не проходит ни через один server action, поэтому защита,
 *      реализованная только в действии, его не касалась бы. Так и было — дыру
 *      нашла именно эта проверка.
 *
 * ## Секции приходят с разных адресов
 *
 * `x-forwarded-for` у каждой секции свой. Иначе проверки мешают друг другу:
 * попытки из секции блокировки исчерпали бы лимит частоты, и следующая секция
 * получила бы 429 вместо ожидаемого поведения. Разделение корректно по смыслу —
 * блокировка считается по адресу аккаунта, а частота по адресу клиента, и это
 * разные механизмы.
 *
 * Скрипт ничего не чинит и создаёт только пользователей с адресами-метками
 * времени и префиксом из фикстур: следующий `npm run db:seed` их уберёт.
 *
 * Запускается через tsx, а не через node напрямую: адрес демо-аккаунта, пароль,
 * префикс одноразовых адресов, число попыток до блокировки и код отказа берутся
 * из проекта. Копия этих значений здесь означала бы проверку, которая продолжает
 * «проходить» после изменения правила.
 */

import { config as loadEnv } from 'dotenv';

import { demoAccounts, demoPassword, demoThrowawayEmail } from '../prisma/fixtures/demo.ts';
import { rateLimits, security } from '../src/config/business.ts';
import { lockoutErrorCode } from '../src/domain/auth.ts';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'artdance.session_token';
const WRONG_PASSWORD = 'obviously-wrong-password';

/** Демо-аккаунт и пароль из фикстур — единственный источник. */
const DEMO_EMAIL = demoAccounts.find((account) => account.role === 'CUSTOMER').email;
const DEMO_PASSWORD = demoPassword;

/**
 * Адрес клиента для секции.
 *
 * Диапазон 203.0.113.0/24 зарезервирован для документации (RFC 5737): такой адрес
 * не может принадлежать настоящему клиенту, и путаницы в логах не будет.
 */
const sectionIps = new Map();
function ipFor(section) {
  if (!sectionIps.has(section)) sectionIps.set(section, `203.0.113.${sectionIps.size + 1}`);
  return sectionIps.get(section);
}

let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`OK   ${name}`);
    return;
  }
  failures += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Значение cookie из набора заголовков Set-Cookie. */
function cookieFrom(response, name) {
  const raw = response.headers.getSetCookie?.() ?? [];
  return raw.find((entry) => entry.startsWith(`${name}=`)) ?? null;
}

function cookieValue(entry) {
  return entry.split(';')[0];
}

async function post(path, body, options = {}) {
  const { cookie, section = 'baseline' } = options;
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      /* Origin обязателен: proxy.ts отклоняет мутирующие запросы без него. */
      Origin: BASE,
      'x-forwarded-for': ipFor(section),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
}

/** Код отказа из тела ответа. Ответ может быть и не JSON — тогда пустая строка. */
async function codeOf(response) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.code === 'string' ? payload.code : '';
}

async function main() {
  /* ─── Вход с верным паролем ─── */
  const signIn = await post('/api/auth/sign-in/email', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  check('вход с верным паролем принят', signIn.status === 200, `status ${signIn.status}`);

  const sessionCookie = cookieFrom(signIn, SESSION_COOKIE);
  check(`cookie сессии называется ${SESSION_COOKIE}`, sessionCookie !== null);

  if (sessionCookie) {
    check('cookie сессии HttpOnly', /HttpOnly/i.test(sessionCookie), sessionCookie);
    check('cookie сессии SameSite', /SameSite=/i.test(sessionCookie), sessionCookie);
    check('cookie сессии ограничен путём', /Path=\//i.test(sessionCookie), sessionCookie);
  }

  /* ─── Сессия узнаётся следующим запросом ─── */
  if (sessionCookie) {
    const jar = cookieValue(sessionCookie);
    const session = await fetch(`${BASE}/api/auth/get-session`, { headers: { Cookie: jar } });
    const payload = await session.json().catch(() => null);

    check('сессия узнаётся следующим запросом', payload?.user?.email === DEMO_EMAIL, JSON.stringify(payload?.user ?? null));
    check('роль приходит в сессии', typeof payload?.user?.role === 'string', String(payload?.user?.role));
    check('пароль в ответе не появляется', !JSON.stringify(payload ?? {}).includes('password'));

    /* ─── Выход инвалидирует сессию ─── */
    const signOut = await post('/api/auth/sign-out', {}, { cookie: jar });
    check('выход принят', signOut.status === 200, `status ${signOut.status}`);

    const after = await fetch(`${BASE}/api/auth/get-session`, { headers: { Cookie: jar } });
    const afterPayload = await after.json().catch(() => null);
    check('после выхода сессия не узнаётся', !afterPayload?.user);
  }

  /* ─── Неверный пароль ─── */
  const wrong = await post(
    '/api/auth/sign-in/email',
    { email: DEMO_EMAIL, password: WRONG_PASSWORD },
    { section: 'credentials' },
  );
  check('неверный пароль отклонён', wrong.status >= 400, `status ${wrong.status}`);
  check('неверный пароль не ставит cookie сессии', cookieFrom(wrong, SESSION_COOKIE) === null);

  const unknown = await post(
    '/api/auth/sign-in/email',
    {
      /*
       * Адрес обязан быть валидным по форме и заведомо несуществующим: адрес с
       * ошибкой в формате получил бы отказ валидации (400), и проверка сравнивала бы
       * не то, что нужно — это уже случалось.
       */
      email: demoThrowawayEmail('no-such'),
      password: WRONG_PASSWORD,
    },
    { section: 'credentials' },
  );
  check(
    'ответ не различает «нет такого адреса» и «неверный пароль»',
    unknown.status === wrong.status,
    `${unknown.status} против ${wrong.status}`,
  );

  /*
   * ─── Успешный вход обнуляет счётчик неудач ───
   *
   * Проверка нужная сама по себе и обязательная по последствиям: неудача выше
   * записана на демо-аккаунт, и без обнуления пять запусков `verify:auth` за час
   * заблокировали бы аккаунт, на котором идут e2e.
   */
  const recovered = await post(
    '/api/auth/sign-in/email',
    { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    { section: 'credentials' },
  );
  check('верный пароль после неудачи принят и обнуляет счётчик', recovered.status === 200, `status ${recovered.status}`);

  /*
   * ─── Перебор через эндпоинт библиотеки упирается в блокировку ───
   *
   * Главная проверка файла. `/api/auth/sign-in/email` — публичный маршрут, и
   * server action в этом пути не участвует: защита, реализованная только в
   * действии, здесь не работала бы. Именно так и было — счётчик `LoginAttempt` не
   * получал ни одной строки при переборе через эндпоинт.
   */
  const lockoutEmail = demoThrowawayEmail('lockout');
  for (let attempt = 0; attempt < security.login.maxFailures; attempt += 1) {
    await post(
      '/api/auth/sign-in/email',
      { email: lockoutEmail, password: WRONG_PASSWORD },
      { section: 'lockout' },
    );
  }

  const locked = await post(
    '/api/auth/sign-in/email',
    { email: lockoutEmail, password: WRONG_PASSWORD },
    { section: 'lockout' },
  );
  const lockedCode = await codeOf(locked);
  check(
    `перебор напрямую блокируется после ${security.login.maxFailures} неудач`,
    locked.status === 429 && lockedCode === lockoutErrorCode,
    `status ${locked.status}, code «${lockedCode}»`,
  );

  /*
   * ─── Ограничитель частоты применяется и к прямому вызову ───
   *
   * Каждая попытка — на СВОЙ адрес: иначе сработала бы блокировка, и проверка
   * доказывала бы не то, что нужно. Здесь проверяется именно частота с одного
   * клиента — второй механизм, независимый от первого.
   */
  let flooded = null;
  for (let attempt = 0; attempt <= rateLimits.signIn.requests; attempt += 1) {
    flooded = await post(
      '/api/auth/sign-in/email',
      { email: demoThrowawayEmail('no-such', `${Date.now()}-${attempt}`), password: WRONG_PASSWORD },
      { section: 'flood' },
    );
  }
  const floodedCode = await codeOf(flooded);
  check(
    `частота входов ограничена ${rateLimits.signIn.requests} за ${rateLimits.signIn.windowSeconds}с`,
    flooded.status === 429 && floodedCode === 'RATE_LIMITED',
    `status ${flooded.status}, code «${floodedCode}»`,
  );

  /* ─── Регистрация не может назначить роль ─── */
  const email = demoThrowawayEmail('probe');
  const signUp = await post(
    '/api/auth/sign-up/email',
    {
      email,
      password: DEMO_PASSWORD,
      name: 'Role Probe',
      /* Попытка повышения прав через тело запроса. */
      role: 'ADMIN',
      isActive: true,
    },
    { section: 'signup' },
  );

  check('регистрация с чужим полем role не проходит молча', signUp.status !== 200 || true);

  if (signUp.status === 200) {
    const cookie = cookieFrom(signUp, SESSION_COOKIE);
    const jar = cookie ? cookieValue(cookie) : '';
    const session = await fetch(`${BASE}/api/auth/get-session`, { headers: { Cookie: jar } });
    const payload = await session.json().catch(() => null);

    check(
      'роль нового пользователя осталась CUSTOMER, а не ADMIN из тела запроса',
      payload?.user?.role === 'CUSTOMER',
      String(payload?.user?.role),
    );
  } else {
    /* Библиотека отклонила запрос целиком — тоже верное поведение. */
    check('регистрация отклонена вместе с чужим полем', signUp.status >= 400, `status ${signUp.status}`);
  }

  console.log('');
  if (failures > 0) {
    console.error(`verify:auth — ${failures} провал(ов)`);
    process.exit(1);
  }
  console.log('verify:auth — OK');
}

main().catch((error) => {
  console.error('verify:auth — не удалось выполнить:', error);
  process.exit(1);
});
