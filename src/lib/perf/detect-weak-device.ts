/**
 * Детекция слабого устройства для лёгкого режима.
 *
 * Источники:
 *  - navigator.hardwareConcurrency — логических ядер (меньше = слабее)
 *  - navigator.deviceMemory — ГБ RAM (экспериментальный, есть в Chrome/Edge/Opera)
 *  - navigator.connection — saveData / effectiveType (2g/slow-2g)
 *
 * Эвристика консервативная: ложный «слабый» лучше ложного «мощный».
 * Пользователь всегда может выключить лёгкий режим вручную.
 */

export interface WeakDeviceSignals {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
  effectiveType?: string;
}

type NavigatorWithMemory = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

export function collectSignals(): WeakDeviceSignals {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as NavigatorWithMemory;
  return {
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined,
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
  };
}

/**
 * Слабое устройство, если выполняется ЛЮБОЕ:
 *  - ядер <= 4 (большинство бюджетников и старых ноутов)
 *  - памяти <= 4 ГБ
 *  - включён saveData
 *  - сеть 2g / slow-2g
 */
export function isWeakDevice(signals: WeakDeviceSignals = collectSignals()): boolean {
  if (signals.saveData === true) return true;
  if (signals.effectiveType === '2g' || signals.effectiveType === 'slow-2g') return true;
  if (typeof signals.deviceMemory === 'number' && signals.deviceMemory <= 4) return true;
  if (typeof signals.hardwareConcurrency === 'number' && signals.hardwareConcurrency <= 4) return true;
  return false;
}

export const STORAGE_KEY = 'ARTDANCE_LITE_MODE';

/**
 * Inline-скрипт для <head>: ставит data-lite до первого paint,
 * чтобы тяжёлые эффекты не монтировались на слабом устройстве.
 * Дублирует логику isWeakDevice без импорта.
 */
export function liteModeInlineScript(storageKey: string): string {
  // экранируем ключ для безопасной вставки в single-quoted JS-строку
  const safeKey = storageKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `(function(){try{var k='${safeKey}';var v=localStorage.getItem(k);if(v==='true'||v==='on'||v==='true:force'){document.documentElement.setAttribute('data-lite','true');return}if(v==='false'){document.documentElement.setAttribute('data-lite','false');return}var c=navigator.hardwareConcurrency;var m=navigator.deviceMemory;var conn=navigator.connection;var weak=false;if(conn&&conn.saveData)weak=true;else if(conn&&(conn.effectiveType==='2g'||conn.effectiveType==='slow-2g'))weak=true;else if(typeof m==='number'&&m<=4)weak=true;else if(typeof c==='number'&&c<=4)weak=true;document.documentElement.setAttribute('data-lite',weak?'true':'false');if(weak)localStorage.setItem(k,'auto:true');else if(v==='auto:true')localStorage.removeItem(k)}catch(e){}})();`;
}
