import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { NextClassProps } from '../../widgets/next-class-props';

type WidgetModule = typeof import('../../widgets/NextClassWidget');
type ActivityModule = typeof import('../../widgets/NextClassActivity');

/**
 * Виджеты и Live Activity существуют только в iOS-сборке с нативным модулем.
 * В Expo Go и на Android модуль отсутствует: проверяем до загрузки, иначе импорт падает.
 */
export function nativeWidgetsAvailable(): boolean {
  return Platform.OS === 'ios' && requireOptionalNativeModule('ExpoWidgets') != null;
}

// Ленивый require: layout-файлы импортируют expo-widgets, который нельзя вычислять на старте.
function widgetModule(): WidgetModule {
  return require('../../widgets/NextClassWidget') as WidgetModule;
}

function activityModule(): ActivityModule {
  return require('../../widgets/NextClassActivity') as ActivityModule;
}

/** Обновляет данные виджета на главном экране. Без нативного модуля ничего не делает. */
export function updateNextClassWidget(props: NextClassProps): void {
  if (!nativeWidgetsAvailable()) return;
  try {
    widgetModule().NextClassWidget.updateSnapshot(props);
  } catch {
    // Виджет может быть не добавлен на экран: это не ошибка приложения.
  }
}

/** Запускает Live Activity на время занятия. Предыдущий экземпляр закрывается, чтобы не было двух. */
export async function startNextClassActivity(props: NextClassProps, endsAt: Date): Promise<boolean> {
  if (!nativeWidgetsAvailable()) return false;
  const { NextClassActivity } = activityModule();
  await endNextClassActivities();
  NextClassActivity.start(props, undefined, endsAt);
  return true;
}

/** Закрывает все Live Activity занятия (например, после отмены брони). */
export async function endNextClassActivities(): Promise<void> {
  if (!nativeWidgetsAvailable()) return;
  const { NextClassActivity } = activityModule();
  await Promise.all(NextClassActivity.getInstances().map((instance) => instance.end('immediate').catch(() => undefined)));
}
