import * as Haptics from 'expo-haptics';

/** Тактильный отклик не должен влиять на результат операции: отказ модуля глушится. */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticError(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

export function hapticWarning(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

/** Короткий щелчок, как у колеса выбора iOS: смена слайда, карточки рельса, вкладки. */
export function hapticSelection(): void {
  Haptics.selectionAsync().catch(() => undefined);
}

/** Мягкий толчок: появление листа, срабатывание свайпа, открытие превью. */
export function hapticImpact(strength: 'light' | 'medium' | 'heavy' = 'light'): void {
  const style =
    strength === 'heavy'
      ? Haptics.ImpactFeedbackStyle.Heavy
      : strength === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
  Haptics.impactAsync(style).catch(() => undefined);
}
