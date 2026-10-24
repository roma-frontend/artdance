import type { ReactNode } from 'react';
import { View } from 'react-native';

type Props = { open: boolean; children: ReactNode };

export function Collapsible({ open, children }: Props) {
  if (!open) return null;
  return <View>{children}</View>;
}
