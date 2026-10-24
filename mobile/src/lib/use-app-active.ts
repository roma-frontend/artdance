import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Возврат из браузера (оплата) не меняет экран, поэтому слушаем переход приложения в активное состояние. */
export function useAppActive(onActive: () => void): void {
  const ref = useRef(onActive);
  ref.current = onActive;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') ref.current();
    });
    return () => subscription.remove();
  }, []);
}
