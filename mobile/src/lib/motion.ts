import { LayoutAnimation } from 'react-native';
import { Easing, FadeInDown, Keyframe, type EntryOrExitLayoutType } from 'react-native-reanimated';

/** Единая кривая для раскрытия, перехода и появления: быстрый старт, мягкая остановка. */
export const EASE_OUT = Easing.bezier(0.32, 0.72, 0, 1);

export const OPEN_MS = 300;
export const openTiming = { duration: OPEN_MS, easing: EASE_OUT };

/** Нативно анимирует следующее изменение разметки; вызывать перед setState раскрытия. */
export function animateNextLayout() {
  LayoutAnimation.configureNext({
    duration: OPEN_MS,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

/** Появление элемента списка со сдвигом снизу; задержка растёт, но не дольше 10 элементов. */
export function enterItem(index: number, base = 0): EntryOrExitLayoutType {
  return FadeInDown.delay(base + Math.min(index, 10) * 45)
    .duration(420)
    .easing(EASE_OUT);
}

/** 3D-появление карточки: поворот по оси X из глубины и подъём; волна по сетке, не дольше 10 элементов. */
export function enterCard3D(index: number, base = 0): EntryOrExitLayoutType {
  return new Keyframe({
    0: { opacity: 0, transform: [{ perspective: 900 }, { rotateX: '24deg' }, { translateY: 36 }, { scale: 0.94 }] },
    60: { opacity: 1, transform: [{ perspective: 900 }, { rotateX: '-2deg' }, { translateY: -3 }, { scale: 1.01 }] },
    100: { opacity: 1, transform: [{ perspective: 900 }, { rotateX: '0deg' }, { translateY: 0 }, { scale: 1 }] },
  })
    .delay(base + Math.min(index, 10) * 55)
    .duration(620);
}
