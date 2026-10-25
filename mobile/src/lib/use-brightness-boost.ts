import * as Brightness from 'expo-brightness';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Максимальная яркость, пока экран с QR в фокусе: сканер на входе читает код с первого раза.
 * iOS меняет яркость всего устройства, поэтому прежнее значение возвращается при уходе и в фоне.
 */
export function useBrightnessBoost(active: boolean): void {
  useFocusEffect(
    useCallback(() => {
      if (!active || Platform.OS === 'web') return;
      let previous: number | null = null;
      let boosted = false;

      const boost = async () => {
        try {
          if (previous === null) previous = await Brightness.getBrightnessAsync();
          await Brightness.setBrightnessAsync(1);
          boosted = true;
        } catch {
          // Яркость — удобство, а не условие показа пропуска.
        }
      };
      const restore = () => {
        if (!boosted) return;
        boosted = false;
        const done =
          Platform.OS === 'android'
            ? Brightness.restoreSystemBrightnessAsync()
            : previous !== null
              ? Brightness.setBrightnessAsync(previous)
              : Promise.resolve();
        done.catch(() => undefined);
      };

      void boost();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void boost();
        else restore();
      });
      return () => {
        subscription.remove();
        restore();
      };
    }, [active]),
  );
}
