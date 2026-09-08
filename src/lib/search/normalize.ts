/**
 * НОРМАЛИЗАЦИЯ ПОИСКОВОГО ЗАПРОСА — три алфавита и опечатки.
 *
 * Это фича C-03 из бэклога (`docs/07-feature-backlog.md`), и она не косметика.
 * Аудитория платформы пишет одно и то же слово тремя способами: «Բաչատա»,
 * «bachata», «бачата», — и ещё с опечаткой «бочата». Без приведения к общему
 * виду поиск отвечает «ничего не найдено» на запрос о занятии, которое в
 * каталоге есть. Для маркетплейса это прямая потеря заявки.
 *
 * **Как это работает.** У каждой строки есть один ключ поиска — латинский
 * «скелет» (`searchKey`). Ключ считается и для запроса, и для полей каталога,
 * поэтому сравниваются они всегда в одном алфавите. Ключ намеренно грубее
 * официальной транслитерации: `kh` и `h` в нём одна буква, потому что армянское
 * «խ», русское «х» и латинское «h» в именах взаимозаменяемы
 * (Խաչատրյան / Хачатрян / Hachatryan), а различать их — значит не находить.
 *
 * **Одна реализация конвейера.** Ключ и карта подсветки считаются одним и тем же
 * кодом (`keyPipeline`): подсветка обязана находить то же, что нашёл поиск, а два
 * прохода «почти одинаковых преобразований» разъезжаются на первом же
 * исключении. Цена — массив индексов на каждое сравнение; на объёме каталога это
 * незаметно, а в production сравнение уйдёт в индекс PostgreSQL.
 *
 * **Чего здесь нет.** `queryVariants` из `docs/09-helpers-catalog.md` §3 не
 * реализован, и это осознанно: список вариантов написания нужен там, где вторая
 * сторона сравнения — сырая колонка в базе (`ILIKE ANY (...)`). Пока ключ
 * считается по обеим сторонам, N вариантов запроса дают ровно тот же результат,
 * что один общий ключ, но N раз проходят по данным. Варианты вернутся вместе с
 * полнотекстовым индексом — тогда у них появится смысл.
 *
 * Модуль ничего не знает о предметной области: ни о стилях, ни о каталоге. Он
 * работает с буквами. Словарь написаний названий направлений живёт рядом с
 * самими направлениями — `src/domain/enums.ts`.
 */

/* ─────────────────────────── Таблицы алфавитов ───────────────────────────
 *
 * Значения — практическая транслитерация, а не стандарт BGN/PCGN: цель не
 * «правильно записать имя латиницей», а «привести два написания к одному виду».
 * Поэтому ը → e, а не ë, и щ → sh, а не shch.
 */

/** Армянский → латиница. Многобуквенные ключи обрабатываются первыми. */
const armenianToLatin: Readonly<Record<string, string>> = {
  ու: 'u',
  և: 'ev',
  ա: 'a',
  բ: 'b',
  գ: 'g',
  դ: 'd',
  ե: 'e',
  զ: 'z',
  է: 'e',
  ը: 'e',
  թ: 't',
  ժ: 'zh',
  ի: 'i',
  լ: 'l',
  խ: 'kh',
  ծ: 'ts',
  կ: 'k',
  հ: 'h',
  ձ: 'dz',
  ղ: 'gh',
  ճ: 'ch',
  մ: 'm',
  յ: 'y',
  ն: 'n',
  շ: 'sh',
  ո: 'o',
  չ: 'ch',
  պ: 'p',
  ջ: 'j',
  ռ: 'r',
  ս: 's',
  վ: 'v',
  տ: 't',
  ր: 'r',
  ց: 'ts',
  ւ: 'v',
  փ: 'p',
  ք: 'k',
  օ: 'o',
  ֆ: 'f',
};

/** Кириллица → латиница. */
const cyrillicToLatin: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Латиница → кириллица. Диграфы первыми, иначе `sh` станет «сх». */
const latinToCyrillic: Readonly<Record<string, string>> = {
  zh: 'ж',
  kh: 'х',
  gh: 'г',
  dz: 'дз',
  ts: 'ц',
  ch: 'ч',
  sh: 'ш',
  yu: 'ю',
  ya: 'я',
  a: 'а',
  b: 'б',
  c: 'к',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'х',
  i: 'и',
  j: 'дж',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'к',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  w: 'в',
  x: 'кс',
  y: 'й',
  z: 'з',
};

/** Латиница → армянский. */
const latinToArmenian: Readonly<Record<string, string>> = {
  zh: 'ժ',
  kh: 'խ',
  gh: 'ղ',
  dz: 'ձ',
  ts: 'ց',
  ch: 'չ',
  sh: 'շ',
  yu: 'յու',
  ya: 'յա',
  a: 'ա',
  b: 'բ',
  c: 'ց',
  d: 'դ',
  e: 'ե',
  f: 'ֆ',
  g: 'գ',
  h: 'հ',
  i: 'ի',
  j: 'ջ',
  k: 'կ',
  l: 'լ',
  m: 'մ',
  n: 'ն',
  o: 'ո',
  p: 'պ',
  q: 'ք',
  r: 'ր',
  s: 'ս',
  t: 'տ',
  u: 'ու',
  v: 'վ',
  w: 'վ',
  x: 'քս',
  y: 'յ',
  z: 'զ',
};

export type TransliterationTarget = 'lat' | 'hy' | 'cyr';

/* ───────────────────── Строка с картой исходных позиций ─────────────────────
 *
 * `positions[i]` — индекс символа ИСХОДНОЙ строки, из которого вышла `text[i]`.
 * Карта нужна ровно одному потребителю — подсветке совпадений, — но считается
 * вместе с ключом, чтобы подсветка и поиск не могли разойтись.
 */

interface Tracked {
  text: string;
  positions: readonly number[];
}

interface CompiledTable {
  entries: Readonly<Record<string, string>>;
  maxKeyLength: number;
}

function compile(table: Readonly<Record<string, string>>): CompiledTable {
  return {
    entries: table,
    maxKeyLength: Math.max(...Object.keys(table).map((key) => key.length)),
  };
}

const tables = {
  hyToLat: compile(armenianToLatin),
  cyrToLat: compile(cyrillicToLatin),
  latToCyr: compile(latinToCyrillic),
  latToHy: compile(latinToArmenian),
} as const;

/**
 * Замена подстрок по таблице с приоритетом длинного ключа.
 *
 * «Жадность» обязательна: без неё `ու` разбирается как `ո` + `ւ` и даёт «ov»
 * вместо «u», а `sh` при обратном переводе превращается в «сх». Символы, которых
 * в таблице нет (латиница при переводе с армянского, цифры, пробелы), проходят
 * насквозь — это позволяет применять таблицы к смешанному тексту.
 */
function replaceByTable(input: Tracked, table: CompiledTable): Tracked {
  let text = '';
  const positions: number[] = [];

  for (let index = 0; index < input.text.length; ) {
    let length = Math.min(table.maxKeyLength, input.text.length - index);
    let replacement: string | undefined;

    for (; length >= 1; length -= 1) {
      replacement = table.entries[input.text.slice(index, index + length)];
      if (replacement !== undefined) break;
    }

    if (replacement === undefined) {
      text += input.text[index];
      positions.push(input.positions[index]!);
      index += 1;
      continue;
    }

    /* Все буквы замены указывают на начало заменённого куска источника. */
    const source = input.positions[index]!;
    for (const char of replacement) {
      text += char;
      positions.push(source);
    }
    index += length;
  }

  return { text, positions };
}

/**
 * Замена по регулярному выражению с сохранением карты.
 *
 * Общая функция вместо цепочки `String.replace`: без карты подсветка не сможет
 * показать найденное в исходном тексте, а огрубление ключа (`kh` → `h`, сжатие
 * сдвоенных букв) меняет длину строки.
 */
function replaceTracked(
  input: Tracked,
  pattern: RegExp,
  replace: (match: RegExpExecArray) => string,
): Tracked {
  let text = '';
  const positions: number[] = [];
  let cursor = 0;

  for (const match of input.text.matchAll(pattern)) {
    const start = match.index;

    for (let index = cursor; index < start; index += 1) {
      text += input.text[index];
      positions.push(input.positions[index]!);
    }

    const source = input.positions[start] ?? 0;
    for (const char of replace(match as RegExpExecArray)) {
      text += char;
      positions.push(source);
    }

    cursor = start + match[0].length;
  }

  for (let index = cursor; index < input.text.length; index += 1) {
    text += input.text[index];
    positions.push(input.positions[index]!);
  }

  return { text, positions };
}

/* ─────────────────────────── Публичный интерфейс ─────────────────────────── */

const DIACRITICS = /[\u0300-\u036f]/;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]/u;

/**
 * Приводит строку к сопоставимому виду: регистр, диакритика, пунктуация,
 * пробелы.
 *
 * Диакритика снимается через NFD: иначе «Nairi» с составным символом не
 * находится по «Nairi» с предсоставленным — один и тот же текст в двух
 * представлениях Unicode. Пунктуация становится пробелом, а не исчезает:
 * «hip-hop» и «hip hop» обязаны совпадать, а «hiphop» — это уже другое слово, и
 * склеивать его с ними значило бы находить лишнее.
 */
export function normalizeQuery(input: string): string {
  return normalizeTracked(trackSource(input)).text;
}

/** Исходная строка как отслеживаемая: каждый символ указывает на себя. */
function trackSource(input: string): Tracked {
  return { text: input, positions: Array.from({ length: input.length }, (_, index) => index) };
}

/**
 * Нормализация по символам, а не через `String.replace` по всей строке.
 *
 * Причина — карта позиций: NFD раскладывает один символ на два, `toLowerCase`
 * у некоторых символов меняет длину, и после сплошной замены индексы источника
 * уже ничего не значат.
 */
function normalizeTracked(input: Tracked): Tracked {
  let text = '';
  const positions: number[] = [];

  for (let index = 0; index < input.text.length; index += 1) {
    const char = input.text[index]!;
    const source = input.positions[index]!;
    const decomposed = char.normalize('NFD').toLowerCase();

    let produced = '';
    for (const piece of decomposed) {
      if (DIACRITICS.test(piece)) continue;
      produced += NON_ALPHANUMERIC.test(piece) ? ' ' : piece;
    }

    for (const piece of produced) {
      /* Пробелы не удваиваются и не открывают строку: «hip - hop» → «hip hop». */
      if (piece === ' ' && (text.length === 0 || text.endsWith(' '))) continue;
      text += piece;
      positions.push(source);
    }
  }

  /* Замыкающий пробел: у нормализованной строки его быть не должно. */
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    positions.pop();
  }

  return { text, positions };
}

/**
 * Переводит текст в целевой алфавит.
 *
 * Перевод всегда идёт через латиницу: она посредник между армянским и
 * кириллицей, и держать шесть таблиц вместо четырёх незачем. Символы целевого
 * алфавита, уже присутствующие в тексте, не трогаются — смешанный ввод
 * («salsa для начинающих») переводится целиком.
 */
export function transliterate(input: string, target: TransliterationTarget): string {
  const normalized = normalizeTracked(trackSource(input));

  switch (target) {
    case 'lat':
      return toLatin(normalized).text;
    case 'cyr':
      return replaceByTable(replaceByTable(normalized, tables.hyToLat), tables.latToCyr).text;
    case 'hy':
      return replaceByTable(replaceByTable(normalized, tables.cyrToLat), tables.latToHy).text;
  }
}

function toLatin(input: Tracked): Tracked {
  return replaceByTable(replaceByTable(input, tables.hyToLat), tables.cyrToLat);
}

/**
 * Огрубление латиницы до «скелета».
 *
 * Каждая замена закрывает конкретное расхождение между алфавитами, а не
 * улучшает вид строки:
 *
 *   • `kh → h` — խ, х и h в именах взаимозаменяемы (Хачатрян / Hachatryan);
 *   • `gh → g` — ղ передают и как «gh», и как «г» (Ղարեգին / Гарегин);
 *   • `ph → f`, `q → k`, `w → v`, `x → ks` — разные записи одного звука;
 *   • `ye → e` — Երևան / Yerevan / Ереван дают один ключ только так;
 *   • сдвоенная буква сжимается — Աննա / Anna / Анна.
 *
 * Огрубление применяется к обеим сторонам сравнения, поэтому оно не «портит»
 * данные: оно определяет, что для поиска считается одной и той же буквой.
 */
const FOLDINGS: ReadonlyArray<{ pattern: RegExp; to: (match: RegExpExecArray) => string }> = [
  { pattern: /kh/g, to: () => 'h' },
  { pattern: /gh/g, to: () => 'g' },
  { pattern: /ph/g, to: () => 'f' },
  { pattern: /q/g, to: () => 'k' },
  { pattern: /w/g, to: () => 'v' },
  { pattern: /x/g, to: () => 'ks' },
  { pattern: /ye/g, to: () => 'e' },
  { pattern: /(\p{L})\1+/gu, to: (match) => match[1]! },
];

function fold(input: Tracked): Tracked {
  return FOLDINGS.reduce(
    (current, { pattern, to }) => replaceTracked(current, pattern, to),
    input,
  );
}

/** Единственный конвейер ключа: нормализация → латиница → огрубление. */
function keyPipeline(input: string): Tracked {
  return fold(toLatin(normalizeTracked(trackSource(input))));
}

/**
 * Ключ поиска: единственная форма, в которой строки сравниваются.
 *
 * Считается и для запроса, и для полей каталога. Пустая строка означает, что в
 * запросе не было ни буквы, ни цифры, — сравнивать нечего.
 */
export function searchKey(input: string): string {
  return keyPipeline(input).text;
}

/**
 * Расстояние Левенштейна с ранним выходом.
 *
 * Полная матрица здесь не нужна: вопрос всегда «отличается не больше чем на
 * `max`», а не «на сколько именно». Проверка длин отсекает основную часть пар до
 * всякого счёта, а строка матрицы позволяет прервать счёт, как только весь ряд
 * вышел за порог.
 */
export function levenshteinWithin(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (max <= 0) return false;
  if (Math.abs(a.length - b.length) > max) return false;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }

    /* Весь ряд хуже порога — итог тем более будет хуже. */
    if (rowMin > max) return false;
    previous = current;
  }

  return previous[b.length]! <= max;
}

/** Допуск на опечатки. Значения приходят из `limits.search.typo`. */
export interface TypoTolerance {
  minWordLength: number;
  maxEdits: number;
}

/**
 * Совпадение запроса с текстом, допускающее опечатку.
 *
 * Сначала обычное вхождение — так находится и часть слова («сал» → «Salsa»).
 * Если вхождения нет, каждое слово текста сравнивается с запросом по
 * Левенштейну: «бочата» → «бачата». Порог применяется только к словам не короче
 * `minWordLength` — на трёхбуквенных одна правка превращает поиск в лотерею
 * («low» находит «new»).
 *
 * Обе строки должны быть уже приведены `searchKey`.
 */
export function keyIncludes(
  haystackKey: string,
  needleKey: string,
  tolerance: TypoTolerance,
): boolean {
  if (needleKey.length === 0) return true;
  if (haystackKey.includes(needleKey)) return true;
  if (needleKey.length < tolerance.minWordLength) return false;

  return haystackKey
    .split(' ')
    .some(
      (word) =>
        word.length >= tolerance.minWordLength &&
        levenshteinWithin(word, needleKey, tolerance.maxEdits),
    );
}

/* ─────────────────────────── Подсветка совпадений ─────────────────────────── */

/** Отрезок текста и признак «это найденное». */
export interface TextChunk {
  text: string;
  match: boolean;
}

/**
 * Разбивает текст на отрезки, помечая совпадения с запросом.
 *
 * Подсветка идёт по ИСХОДНОМУ тексту, а не по ключу, иначе в результатах вместо
 * «Bachata Basics» показалось бы «bahata basiks»: ключ огрублён и не годится для
 * показа. Границы найденного отображаются обратно по карте позиций, которую
 * конвейер ведёт вместе с ключом.
 *
 * Подсвечивается только точное вхождение ключа. Совпадение по опечатке
 * намеренно не подсвечивается: подчёркнутое «бачата» в ответ на «бочата»
 * выглядит как ошибка отрисовки, а не как исправление.
 */
export function highlightMatches(text: string, query: string): readonly TextChunk[] {
  const needle = searchKey(query);
  const whole: readonly TextChunk[] = [{ text, match: false }];
  if (needle.length === 0 || text.length === 0) return whole;

  const { text: key, positions } = keyPipeline(text);
  const chunks: TextChunk[] = [];
  let cursor = 0;
  let from = 0;

  for (;;) {
    const found = key.indexOf(needle, from);
    if (found === -1) break;

    const start = positions[found] ?? 0;
    /*
     * Конец — начало следующей буквы ключа, а не найденной: иначе теряется
     * последний символ. Замыкающие пробелы и знаки отдаются следующему отрезку,
     * чтобы подсветка не тянулась за слово.
     */
    let end = positions[found + needle.length] ?? text.length;
    while (end > start + 1 && NON_ALPHANUMERIC.test(text[end - 1]!)) end -= 1;

    if (start > cursor) chunks.push({ text: text.slice(cursor, start), match: false });
    chunks.push({ text: text.slice(start, end), match: true });

    cursor = end;
    from = found + needle.length;
  }

  if (chunks.length === 0) return whole;
  if (cursor < text.length) chunks.push({ text: text.slice(cursor), match: false });

  return chunks;
}
