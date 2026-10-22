/**
 * Общий кадр прокрутки: сначала чтения активных эффектов, затем записи.
 * Это разделяет измерения и изменения стилей между подписчиками.
 * Видимость ограничена окном с запасом в одну высоту окна сверху и снизу.
 * Кадры запрашиваются событиями; в покое и в скрытой вкладке цикла нет.
 */

'use client';

export interface ScrollEffect {
  /**
   * Фаза чтения. Только геометрия (`getBoundingClientRect`, `scrollY`,
   * `matchMedia`). Ни одной записи в стиль — иначе следующий эффект в этой же
   * фазе получит пересчёт раскладки, ради устранения которого движок и написан.
   */
  read: () => void;
  /**
   * Фаза записи. Только стиль. Ни одного чтения геометрии — по той же причине
   * с другой стороны: чтение после записи снова требует пересчёта.
   */
  write: () => void;
  /**
   * Узел, видимостью которого ограничен эффект. Пока узел дальше одного экрана
   * от окна, `read` и `write` не вызываются. Без узла эффект активен всегда —
   * так подписываются те, у кого видимость уже проверена иначе.
   */
  element?: Element;
}

interface ObservedElement {
  subscribers: number;
  visible: boolean;
  needsMeasure: boolean;
}

const effects = new Set<ScrollEffect>();
const elements = new Map<Element, ObservedElement>();

let frame: number | null = null;
let listening = false;
let visibilityObserver: IntersectionObserver | null = null;
let visibilityHeight = 0;
let layoutObserver: ResizeObserver | null = null;

/** Один снимок для обеих фаз: новые подписки ждут следующего кадра. */
function tick() {
  frame = null;
  if (effects.size === 0 || document.hidden) return;

  readVisibility();
  const active = [...effects].filter((effect) => !effect.element || isElementNearViewport(effect.element));
  for (const effect of active) {
    if (effects.has(effect)) effect.read();
  }
  for (const effect of active) {
    if (effects.has(effect)) effect.write();
  }
}

/** Общий кадр: сколько бы эффектов ни попросило перерисовку, кадр будет один. */
export function requestScrollFrame() {
  if (frame === null && effects.size > 0 && !document.hidden) {
    frame = window.requestAnimationFrame(tick);
  }
}

function cancelFrame() {
  if (frame === null) return;
  window.cancelAnimationFrame(frame);
  frame = null;
}

function onLayoutChange() {
  for (const state of elements.values()) state.needsMeasure = true;
  requestScrollFrame();
}

function onVisibilityChange() {
  if (document.hidden) cancelFrame();
  else onLayoutChange();
}

function startListening() {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', requestScrollFrame, { passive: true });
  window.addEventListener('resize', onLayoutChange, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Ленивый контент и размеры секций могут измениться без прокрутки.
  layoutObserver = new ResizeObserver((_, observer) => {
    if (observer === layoutObserver) onLayoutChange();
  });
  layoutObserver.observe(document.documentElement);
  if (document.body) layoutObserver.observe(document.body);
}

function stopListening() {
  if (!listening) return;
  listening = false;
  window.removeEventListener('scroll', requestScrollFrame);
  window.removeEventListener('resize', onLayoutChange);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  cancelFrame();
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  visibilityHeight = 0;
  layoutObserver?.disconnect();
  layoutObserver = null;
  elements.clear();
}

/** Геометрия читается только в начале кадра, никогда при подписке или записи. */
function readVisibility() {
  if (elements.size === 0) return;
  const height = window.innerHeight;
  const width = window.innerWidth;

  if (!visibilityObserver || visibilityHeight !== height) {
    visibilityObserver?.disconnect();
    visibilityHeight = height;
    visibilityObserver = new IntersectionObserver(
      (entries, observer) => {
        // После resize/размонтирования в очереди ещё могут быть старые сообщения.
        if (observer !== visibilityObserver) return;
        let entered = false;
        for (const entry of entries) {
          const state = elements.get(entry.target);
          if (!state) continue;
          if (entry.isIntersecting && !state.visible) entered = true;
          state.visible = entry.isIntersecting;
        }
        if (entered) requestScrollFrame();
      },
      // Проценты rootMargin считаются от ШИРИНЫ окна, а нужен вертикальный запас.
      { rootMargin: `${height}px 0px` },
    );
    for (const [element, state] of elements) {
      visibilityObserver.observe(element);
      state.needsMeasure = true;
    }
  }

  for (const [element, state] of elements) {
    if (!state.needsMeasure) continue;
    const rect = element.getBoundingClientRect();
    state.visible = rect.bottom >= -height && rect.top <= height + height
      && rect.right >= 0 && rect.left <= width;
    state.needsMeasure = false;
  }
  // Первый кадр и обновления раскладки измерены; скролл использует только кеш IO.
}

function isLayoutRoot(element: Element) {
  return element === document.documentElement || element === document.body;
}

/**
 * Подписать эффект на общий кадр прокрутки.
 *
 * Возвращает функцию отписки — её возвращает `useEffect`, поэтому отписка
 * происходит вместе с размонтированием. Отписка обязательна: без неё эффект
 * остался бы в наборе и продолжал измерять снятый с документа узел.
 *
 * Первый кадр заказывается сразу: эффект обязан стоять на своём месте при
 * загрузке страницы в середине (переход по якорю, возврат из истории), а не
 * ждать первого события прокрутки, которого может не быть вовсе.
 */
export function registerScrollEffect(effect: ScrollEffect): () => void {
  // Отдельная идентичность нужна и при повторной подписке того же объекта.
  const subscription = { ...effect };
  effects.add(subscription);
  startListening();

  const element = subscription.element;
  if (element) {
    const state = elements.get(element);
    if (state) state.subscribers++;
    else {
      elements.set(element, { subscribers: 1, visible: false, needsMeasure: true });
      visibilityObserver?.observe(element);
      if (!isLayoutRoot(element)) layoutObserver?.observe(element);
    }
  }

  requestScrollFrame();

  return () => {
    if (!effects.delete(subscription)) return;
    if (element) {
      const state = elements.get(element)!;
      if (--state.subscribers === 0) {
        elements.delete(element);
        visibilityObserver?.unobserve(element);
        if (!isLayoutRoot(element)) layoutObserver?.unobserve(element);
      }
    }
    if (effects.size === 0) stopListening();
  };
}

/**
 * Последняя известная видимость зарегистрированного узла, без чтения геометрии.
 * До первого кадра и после последней отписки возвращает false.
 */
export function isElementNearViewport(element: Element): boolean {
  return elements.get(element)?.visible ?? false;
}
