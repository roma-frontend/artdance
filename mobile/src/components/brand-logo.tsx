import { Image } from 'expo-image';
import { type StyleProp, type ViewStyle, View } from 'react-native';

import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

/** Растровый исходник 1151×389 (вариант для тёмного фона): без трассировки, чёткий при любом размере. */
export const BRAND_LOGO_SOURCE = require('../../assets/brand/logo-on-dark.png');
const BRAND_LOGO_RATIO = 1151 / 389;

export function brandLogoHeight(width: number): number {
  return width / BRAND_LOGO_RATIO;
}

type Props = { width: number; style?: StyleProp<ViewStyle> };

export function BrandLogo({ width, style }: Props) {
  const t = catalogFor(deviceLocale(undefined));
  const height = brandLogoHeight(width);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t.brand.name} style={[{ width, height }, style]}>
      <Image source={BRAND_LOGO_SOURCE} style={{ width, height }} contentFit="contain" />
    </View>
  );
}
