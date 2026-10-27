import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { createLiveActivity } from 'expo-widgets';

import type { NextClassProps } from './next-class-props';

const GOLD = '#C9A96E';
const CREAM = '#F5F1EA';

/**
 * Live Activity для занятия на экране блокировки и в Dynamic Island.
 * Запускается из экрана пропуска (src/lib/native-widgets.ts). В app.json записи в `widgets` не нужно:
 * Live Activity не является виджетом из галереи.
 */
export const NextClassActivity = createLiveActivity<NextClassProps>('NextClassActivity', (props) => {
  'widget';
  return {
    banner: (
      <VStack>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(GOLD)]}>{props.label}</Text>
        <Text modifiers={[font({ size: 18, weight: 'bold' }), foregroundStyle(CREAM)]}>{props.title}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(CREAM)]}>{props.when}</Text>
        <Spacer />
      </VStack>
    ),
    compactLeading: <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(GOLD)]}>{props.short}</Text>,
    compactTrailing: <Text modifiers={[font({ size: 13 }), foregroundStyle(CREAM)]}>{props.title}</Text>,
    minimal: <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(GOLD)]}>{props.short}</Text>,
  };
});
