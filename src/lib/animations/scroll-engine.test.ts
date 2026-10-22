import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ScrollEngine from './scroll-engine';

function createElement(top = 0, left = 0) {
  const measure = vi.fn(() => ({
    top,
    bottom: top + 100,
    left,
    right: left + 100,
    width: 100,
    height: 100,
  } as DOMRect));
  return {
    element: { getBoundingClientRect: measure } as unknown as Element,
    measure,
    move(nextTop: number) { top = nextTop; },
  };
}

function createBrowser() {
  const frames = new Map<number, FrameRequestCallback>();
  // Ноль — допустимый ID кадра, поэтому он не должен означать «кадра нет».
  let nextFrame = 0;
  const window = Object.assign(new EventTarget(), {
    innerHeight: 600,
    innerWidth: 1200,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    }),
    cancelAnimationFrame: vi.fn((id: number) => { frames.delete(id); }),
  });
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    documentElement: createElement().element,
    body: createElement().element,
  });
  vi.spyOn(window, 'addEventListener');
  vi.spyOn(window, 'removeEventListener');
  vi.spyOn(document, 'addEventListener');
  vi.spyOn(document, 'removeEventListener');

  type Intersection = Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>;
  type IntersectionCallback = (entries: Intersection[], observer: IntersectionObserverStub) => void;
  const intersections: IntersectionObserverStub[] = [];
  class IntersectionObserverStub {
    private readonly callback: IntersectionCallback;
    readonly options: IntersectionObserverInit;
    observe = vi.fn<(target: Element) => void>();
    unobserve = vi.fn<(target: Element) => void>();
    disconnect = vi.fn();

    constructor(callback: IntersectionCallback, options: IntersectionObserverInit) {
      this.callback = callback;
      this.options = options;
      intersections.push(this);
    }

    emit(target: Element, isIntersecting: boolean) {
      this.callback([{ target, isIntersecting }], this);
    }
  }

  type ResizeCallback = (entries: ResizeObserverEntry[], observer: ResizeObserverStub) => void;
  const resizes: ResizeObserverStub[] = [];
  class ResizeObserverStub {
    private readonly callback: ResizeCallback;
    observe = vi.fn<(target: Element) => void>();
    unobserve = vi.fn<(target: Element) => void>();
    disconnect = vi.fn();

    constructor(callback: ResizeCallback) {
      this.callback = callback;
      resizes.push(this);
    }

    emit() { this.callback([], this); }
  }

  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);

  return {
    window,
    document,
    frames,
    intersections,
    resizes,
    flushFrame() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(0);
    },
    scroll() { window.dispatchEvent(new Event('scroll')); },
    resize() { window.dispatchEvent(new Event('resize')); },
    setHidden(hidden: boolean) {
      document.hidden = hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    },
  };
}

describe('scroll engine', () => {
  let browser: ReturnType<typeof createBrowser>;
  let engine: typeof ScrollEngine;
  let cleanups: Array<() => void>;

  function register(effect: ScrollEngine.ScrollEffect) {
    const unregister = engine.registerScrollEffect(effect);
    cleanups.push(unregister);
    return unregister;
  }

  beforeEach(async () => {
    vi.resetModules();
    browser = createBrowser();
    cleanups = [];
    engine = await import('./scroll-engine');
  });

  afterEach(() => {
    for (const unregister of cleanups) unregister();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('coalesces requests, reads the whole snapshot before writing, and stays idle', () => {
    const calls: string[] = [];
    for (const name of ['a', 'b']) {
      register({ read: () => { calls.push(`read:${name}`); }, write: () => { calls.push(`write:${name}`); } });
    }
    engine.requestScrollFrame();
    browser.scroll();
    browser.scroll();
    expect(browser.frames.size).toBe(1);
    expect(browser.window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(browser.window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    expect(browser.window.addEventListener).toHaveBeenCalledTimes(2);

    browser.flushFrame();
    expect(calls).toEqual(['read:a', 'read:b', 'write:a', 'write:b']);
    expect(browser.frames.size).toBe(0);
    browser.flushFrame();
    expect(calls).toHaveLength(4);

    browser.scroll();
    browser.scroll();
    browser.flushFrame();
    expect(calls).toEqual(['read:a', 'read:b', 'write:a', 'write:b', 'read:a', 'read:b', 'write:a', 'write:b']);
    expect(browser.frames.size).toBe(0);
  });

  it('initializes visibility in the first read phase and never polls offscreen geometry on scroll', () => {
    const near = createElement(1100);
    const far = createElement(1300);
    const nearEffect = { element: near.element, read: vi.fn(), write: vi.fn() };
    const farEffect = { element: far.element, read: vi.fn(), write: vi.fn() };
    const globalEffect = { read: vi.fn(), write: vi.fn() };
    register(nearEffect);
    register(farEffect);
    register(globalEffect);
    expect(near.measure).not.toHaveBeenCalled();
    expect(far.measure).not.toHaveBeenCalled();

    // Первый кадр не зависит от асинхронного первого сообщения наблюдателя.
    browser.flushFrame();
    expect(browser.intersections).toHaveLength(1);
    expect(browser.intersections[0]!.options.rootMargin).toBe('600px 0px');
    expect(engine.isElementNearViewport(near.element)).toBe(true);
    expect(engine.isElementNearViewport(far.element)).toBe(false);
    expect(engine.isElementNearViewport(createElement().element)).toBe(false);
    expect(nearEffect.read).toHaveBeenCalledTimes(1);
    expect(nearEffect.write).toHaveBeenCalledTimes(1);
    expect(farEffect.read).not.toHaveBeenCalled();
    expect(farEffect.write).not.toHaveBeenCalled();

    for (let i = 0; i < 3; i++) {
      browser.scroll();
      browser.flushFrame();
    }
    expect(near.measure).toHaveBeenCalledTimes(1);
    expect(far.measure).toHaveBeenCalledTimes(1);
    expect(farEffect.read).not.toHaveBeenCalled();
    expect(farEffect.write).not.toHaveBeenCalled();
    expect(globalEffect.read).toHaveBeenCalledTimes(4);
    expect(globalEffect.write).toHaveBeenCalledTimes(4);
    expect(browser.frames.size).toBe(0);
  });

  it.each([
    [-700, 0, true],
    [-701, 0, false],
    [1200, 0, true],
    [1201, 0, false],
    [0, 1300, false],
    [0, -101, false],
  ] as const)('uses a viewport-height lookahead for initial bounds (top %s, left %s)', (top, left, near) => {
    const target = createElement(top, left);
    const read = vi.fn();
    register({ element: target.element, read, write: vi.fn() });
    browser.flushFrame();
    expect(engine.isElementNearViewport(target.element)).toBe(near);
    expect(read).toHaveBeenCalledTimes(near ? 1 : 0);
  });

  it('pauses offscreen effects and refreshes on observer reentry without a scroll event', () => {
    const target = createElement();
    const effect = { element: target.element, read: vi.fn(), write: vi.fn() };
    register(effect);
    browser.flushFrame();
    const observer = browser.intersections[0]!;

    target.move(2400);
    observer.emit(target.element, false);
    browser.scroll();
    browser.flushFrame();
    browser.scroll();
    browser.flushFrame();
    expect(engine.isElementNearViewport(target.element)).toBe(false);
    expect(effect.read).toHaveBeenCalledTimes(1);
    expect(effect.write).toHaveBeenCalledTimes(1);
    expect(target.measure).toHaveBeenCalledTimes(1);

    target.move(100);
    observer.emit(target.element, true);
    expect(browser.frames.size).toBe(1);
    browser.flushFrame();
    expect(engine.isElementNearViewport(target.element)).toBe(true);
    expect(effect.read).toHaveBeenCalledTimes(2);
    expect(effect.write).toHaveBeenCalledTimes(2);
    expect(target.measure).toHaveBeenCalledTimes(1);
    expect(browser.frames.size).toBe(0);
  });

  it('observes a shared element once and unobserves only after its final subscriber leaves', () => {
    const target = createElement();
    const second = { element: target.element, read: vi.fn(), write: vi.fn() };
    const unregisterFirst = register({ element: target.element, read: vi.fn(), write: vi.fn() });
    const unregisterSecond = register(second);
    register({ read: vi.fn(), write: vi.fn() });
    browser.flushFrame();
    const observer = browser.intersections[0]!;
    const resize = browser.resizes[0]!;
    expect(observer.observe).toHaveBeenCalledExactlyOnceWith(target.element);
    expect(resize.observe.mock.calls.filter(([element]) => element === target.element)).toHaveLength(1);

    unregisterFirst();
    unregisterFirst();
    expect(observer.unobserve).not.toHaveBeenCalled();
    expect(resize.unobserve).not.toHaveBeenCalled();
    expect(engine.isElementNearViewport(target.element)).toBe(true);
    browser.scroll();
    browser.flushFrame();
    expect(second.read).toHaveBeenCalledTimes(2);
    expect(second.write).toHaveBeenCalledTimes(2);

    unregisterSecond();
    expect(observer.unobserve).toHaveBeenCalledExactlyOnceWith(target.element);
    expect(resize.unobserve).toHaveBeenCalledExactlyOnceWith(target.element);
    expect(observer.disconnect).not.toHaveBeenCalled();
    observer.emit(target.element, true);
    expect(engine.isElementNearViewport(target.element)).toBe(false);
    expect(browser.frames.size).toBe(0);
  });

  it('keeps independent subscriptions when the same effect object is registered twice', () => {
    const target = createElement();
    const effect = { element: target.element, read: vi.fn(), write: vi.fn() };
    const unregisterFirst = register(effect);
    register(effect);
    browser.flushFrame();
    expect(effect.read).toHaveBeenCalledTimes(2);
    unregisterFirst();
    unregisterFirst();
    browser.scroll();
    browser.flushFrame();
    expect(effect.read).toHaveBeenCalledTimes(3);
    expect(effect.write).toHaveBeenCalledTimes(3);
    expect(browser.intersections[0]!.unobserve).not.toHaveBeenCalled();
  });

  it('cancels and resets everything on last unregister, ignoring callbacks from the old observers', () => {
    const target = createElement();
    const effect = { element: target.element, read: vi.fn(), write: vi.fn() };
    const unregister = register(effect);
    browser.flushFrame();
    const observer = browser.intersections[0]!;
    const resize = browser.resizes[0]!;
    engine.requestScrollFrame();
    const pendingId = [...browser.frames.keys()][0];
    unregister();
    expect(browser.window.cancelAnimationFrame).toHaveBeenCalledWith(pendingId);
    expect(browser.frames.size).toBe(0);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(resize.disconnect).toHaveBeenCalledTimes(1);
    expect(browser.window.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(browser.window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(browser.document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(engine.isElementNearViewport(target.element)).toBe(false);
    browser.scroll();
    browser.resize();
    engine.requestScrollFrame();
    expect(browser.frames.size).toBe(0);

    target.move(2400);
    register(effect);
    browser.flushFrame();
    expect(browser.intersections).toHaveLength(2);
    expect(browser.resizes).toHaveLength(2);
    expect(target.measure).toHaveBeenCalledTimes(2);
    expect(effect.read).toHaveBeenCalledTimes(1);
    observer.emit(target.element, true);
    resize.emit();
    expect(engine.isElementNearViewport(target.element)).toBe(false);
    expect(browser.frames.size).toBe(0);
  });

  it('cancels a pending first frame when unregistered before it runs', () => {
    const read = vi.fn();
    const unregister = register({ read, write: vi.fn() });
    unregister();
    expect(browser.window.cancelAnimationFrame).toHaveBeenCalledWith(0);
    expect(browser.frames.size).toBe(0);
    browser.flushFrame();
    expect(read).not.toHaveBeenCalled();
  });

  it('cancels while hidden and refreshes both visibility and measurements on return', () => {
    const leaving = createElement(100);
    const entering = createElement(2400);
    const first = { element: leaving.element, read: vi.fn(), write: vi.fn() };
    const second = { element: entering.element, read: vi.fn(), write: vi.fn() };
    register(first);
    register(second);
    browser.flushFrame();
    browser.scroll();
    const pendingId = [...browser.frames.keys()][0];
    browser.setHidden(true);
    expect(browser.window.cancelAnimationFrame).toHaveBeenCalledWith(pendingId);
    expect(browser.frames.size).toBe(0);

    leaving.move(2400);
    entering.move(100);
    browser.scroll();
    browser.resize();
    browser.resizes[0]!.emit();
    engine.requestScrollFrame();
    browser.flushFrame();
    expect(browser.frames.size).toBe(0);
    expect(first.read).toHaveBeenCalledTimes(1);
    expect(second.read).not.toHaveBeenCalled();
    expect(leaving.measure).toHaveBeenCalledTimes(1);
    expect(entering.measure).toHaveBeenCalledTimes(1);

    browser.setHidden(false);
    expect(browser.frames.size).toBe(1);
    browser.flushFrame();
    expect(first.read).toHaveBeenCalledTimes(1);
    expect(first.write).toHaveBeenCalledTimes(1);
    expect(second.read).toHaveBeenCalledTimes(1);
    expect(second.write).toHaveBeenCalledTimes(1);
    expect(leaving.measure).toHaveBeenCalledTimes(2);
    expect(entering.measure).toHaveBeenCalledTimes(2);
    expect(browser.frames.size).toBe(0);
  });

  it('defers registration measurements until a hidden document becomes visible', () => {
    browser.setHidden(true);
    const target = createElement();
    const read = vi.fn();
    register({ element: target.element, read, write: vi.fn() });
    expect(browser.frames.size).toBe(0);
    expect(target.measure).not.toHaveBeenCalled();
    browser.setHidden(false);
    browser.flushFrame();
    expect(target.measure).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(browser.frames.size).toBe(0);
  });

  it('refreshes on resize and rebuilds the pixel lookahead only when viewport height changes', () => {
    const target = createElement(1500);
    const effect = { element: target.element, read: vi.fn(), write: vi.fn() };
    register(effect);
    browser.flushFrame();
    const oldObserver = browser.intersections[0]!;
    expect(effect.read).not.toHaveBeenCalled();

    browser.window.innerHeight = 1000;
    browser.resize();
    browser.resize();
    expect(browser.frames.size).toBe(1);
    browser.flushFrame();
    expect(oldObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(browser.intersections).toHaveLength(2);
    expect(browser.intersections[1]!.options.rootMargin).toBe('1000px 0px');
    expect(browser.intersections[1]!.observe).toHaveBeenCalledExactlyOnceWith(target.element);
    expect(target.measure).toHaveBeenCalledTimes(2);
    expect(effect.read).toHaveBeenCalledTimes(1);
    expect(effect.write).toHaveBeenCalledTimes(1);
    oldObserver.emit(target.element, false);
    expect(engine.isElementNearViewport(target.element)).toBe(true);

    browser.window.innerWidth = 800;
    browser.resize();
    browser.flushFrame();
    expect(browser.intersections).toHaveLength(2);
    expect(effect.read).toHaveBeenCalledTimes(2);
    expect(browser.frames.size).toBe(0);
  });

  it('refreshes effects after document or target size changes without a scroll or idle loop', () => {
    const target = createElement(100);
    const entering = createElement(2400);
    let top = 0;
    const positions: number[] = [];
    register({
      element: target.element,
      read: () => { top = target.element.getBoundingClientRect().top; },
      write: () => { positions.push(top); },
    });
    const enteringRead = vi.fn();
    register({ element: entering.element, read: enteringRead, write: vi.fn() });
    browser.flushFrame();
    const resize = browser.resizes[0]!;
    expect(browser.resizes).toHaveLength(1);
    expect(resize.observe).toHaveBeenCalledWith(browser.document.documentElement);
    expect(resize.observe).toHaveBeenCalledWith(browser.document.body);
    expect(resize.observe).toHaveBeenCalledWith(target.element);
    expect(positions).toEqual([100]);

    target.move(300);
    entering.move(100);
    resize.emit();
    resize.emit();
    expect(browser.frames.size).toBe(1);
    browser.flushFrame();
    expect(positions).toEqual([100, 300]);
    expect(enteringRead).toHaveBeenCalledTimes(1);
    expect(browser.intersections).toHaveLength(1);
    expect(browser.frames.size).toBe(0);
  });

  it.each(['read', 'write'] as const)('defers effects registered during %s to the next snapshot', (phase) => {
    const calls: string[] = [];
    const target = createElement();
    let added = false;
    function addEffect() {
      if (added) return;
      added = true;
      register({
        element: target.element,
        read: () => { calls.push('read:late'); },
        write: () => { calls.push('write:late'); },
      });
    }
    register({
      read: () => { calls.push('read:first'); if (phase === 'read') addEffect(); },
      write: () => { calls.push('write:first'); if (phase === 'write') addEffect(); },
    });
    register({ read: () => { calls.push('read:second'); }, write: () => { calls.push('write:second'); } });
    browser.flushFrame();
    expect(calls).toEqual(['read:first', 'read:second', 'write:first', 'write:second']);
    expect(target.measure).not.toHaveBeenCalled();
    expect(browser.frames.size).toBe(1);
    calls.length = 0;
    browser.flushFrame();
    expect(calls).toEqual(['read:first', 'read:second', 'read:late', 'write:first', 'write:second', 'write:late']);
    expect(target.measure).toHaveBeenCalledTimes(1);
    expect(browser.frames.size).toBe(0);
  });

  it('skips unsubscribed callbacks, including effects removed after their read', () => {
    const calls: string[] = [];
    const unregisterFirst = register({
      read: () => {
        calls.push('read:first');
        unregisterFirst();
        unregisterSecond();
      },
      write: () => { calls.push('write:first'); },
    });
    const unregisterSecond = register({ read: () => { calls.push('read:second'); }, write: vi.fn() });
    register({
      read: () => { calls.push('read:third'); },
      write: () => { calls.push('write:third'); unregisterFourth(); },
    });
    const unregisterFourth = register({
      read: () => { calls.push('read:fourth'); },
      write: () => { calls.push('write:fourth'); },
    });
    browser.flushFrame();
    expect(calls).toEqual(['read:first', 'read:third', 'read:fourth', 'write:third']);
    expect(browser.frames.size).toBe(0);
  });
});
