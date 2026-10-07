'use client';

import { createContext, useContext, useSyncExternalStore, useCallback, useMemo } from 'react';

import { STORAGE_KEY } from './detect-weak-device';

type LiteModeValue = 'auto' | 'on' | 'off';

function readMode(): LiteModeValue {
  if (typeof window === 'undefined') return 'auto';
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'true' || raw === 'auto:true') return 'auto';
  if (raw === 'false') return 'off';
  // legacy: explicit on/off
  if (raw === 'on' || raw === 'true:force') return 'on';
  return 'auto';
}

function isLiteActive(mode: LiteModeValue): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  // auto — читаем атрибут, который поставил inline-скрипт
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-lite');
    if (attr === 'true') return true;
    if (attr === 'false') return false;
  }
  return false;
}

function writeMode(next: LiteModeValue, active: boolean): void {
  if (typeof window === 'undefined') return;
  if (next === 'auto') {
    // auto храним как auto:true/false только если детекция сработала; иначе просто убираем ключ
    if (active) localStorage.setItem(STORAGE_KEY, 'auto:true');
    else localStorage.removeItem(STORAGE_KEY);
    document.documentElement.setAttribute('data-lite', active ? 'true' : 'false');
  } else if (next === 'on') {
    localStorage.setItem(STORAGE_KEY, 'true');
    document.documentElement.setAttribute('data-lite', 'true');
  } else {
    localStorage.setItem(STORAGE_KEY, 'false');
    document.documentElement.setAttribute('data-lite', 'false');
  }
  window.dispatchEvent(new CustomEvent('lite-mode-change'));
}

const LiteContext = createContext<{ enabled: boolean; mode: LiteModeValue; setMode: (m: LiteModeValue) => void } | null>(null);

function subscribe(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener('storage', handler);
  window.addEventListener('lite-mode-change', handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('lite-mode-change', handler);
  };
}

export function LiteModeProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const mode = useSyncExternalStore(subscribe, readMode, () => 'auto' as LiteModeValue);
  const enabled = useSyncExternalStore(
    (cb) => {
      const h = () => cb();
      window.addEventListener('storage', h);
      window.addEventListener('lite-mode-change', h);
      // также слушаем изменение атрибута — детекция ставит его до гидратации
      const obs = new MutationObserver(h);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lite'] });
      return () => {
        window.removeEventListener('storage', h);
        window.removeEventListener('lite-mode-change', h);
        obs.disconnect();
      };
    },
    () => isLiteActive(mode),
    () => false,
  );

  // Атрибут задают ранний inline-скрипт и writeMode. Нельзя записывать сюда
  // SSR snapshot enabled=false: первый effect затирал true до чтения store,
  // из-за чего слабое устройство самопроизвольно включало тяжёлые эффекты.

  const setMode = useCallback((next: LiteModeValue) => {
    // для auto — пересчитываем weak детекцию
    if (next === 'auto') {
      const c = (navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency;
      const m = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
      const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      let weak = false;
      if (conn?.saveData) weak = true;
      else if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') weak = true;
      else if (typeof m === 'number' && m <= 4) weak = true;
      else if (typeof c === 'number' && c <= 4) weak = true;
      writeMode('auto', weak);
    } else {
      writeMode(next, next === 'on');
    }
  }, []);

  const value = useMemo(() => ({ enabled, mode, setMode }), [enabled, mode, setMode]);

  return <LiteContext.Provider value={value}>{children}</LiteContext.Provider>;
}

export function useLiteMode(): { enabled: boolean; mode: LiteModeValue; setMode: (m: LiteModeValue) => void } {
  const ctx = useContext(LiteContext);
  if (!ctx) throw new Error('useLiteMode must be used within LiteModeProvider');
  return ctx;
}

/** Удобный хук — просто «включён ли лёгкий режим». */
export function useIsLiteMode(): boolean {
  const ctx = useContext(LiteContext);
  if (!ctx) return false;
  return ctx.enabled;
}


