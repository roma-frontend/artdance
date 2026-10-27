import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { createWidget } from 'expo-widgets';

import type { NextClassProps } from './next-class-props';

const GOLD = '#C9A96E';
const CREAM = '#F5F1EA';

/** Начальные данные до первой синхронизации: пустое состояние, без привязки к пользователю. */
const initialProps: NextClassProps = {
  label: 'ArtDance',
  title: '',
  when: '',
  short: '',
  empty: 'Запишись на занятие',
};

/**
 * Виджет главного экрана. Данные приходят через `updateSnapshot` из JS (см. src/lib/next-class.ts).
 * Layout выполняется нативно, поэтому внутри функции нельзя использовать хуки и RN-компоненты.
 */
export const NextClassWidget = createWidget<NextClassProps>(
  'NextClassWidget',
  (props) => {
    'widget';
    return (
      <VStack modifiers={[padding({ top: 14, bottom: 14, leading: 16, trailing: 16 })]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(GOLD)]}>{props.label}</Text>
        <Spacer />
        {props.title ? <Text modifiers={[font({ size: 18, weight: 'bold' }), foregroundStyle(CREAM)]}>{props.title}</Text> : null}
        {props.title ? <Text modifiers={[font({ size: 13 }), foregroundStyle(CREAM)]}>{props.when}</Text> : null}
        {props.title ? null : <Text modifiers={[font({ size: 14 }), foregroundStyle(CREAM)]}>{props.empty}</Text>}
      </VStack>
    );
  },
  initialProps,
);
