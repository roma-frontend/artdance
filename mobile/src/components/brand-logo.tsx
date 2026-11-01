import { Image } from 'expo-image';
import { type StyleProp, type ViewStyle, View } from 'react-native';

import { catalogFor } from '@/i18n/catalog';
import { mediaUri } from '@/lib/catalog';
import { deviceLocale } from '@/lib/i18n';

/** Логотип из R2 — тот же файл `brand/logo.png` (1151×389), что на вебе. Не встроенный в приложение. */
export const BRAND_LOGO_SOURCE = { uri: mediaUri('brand/logo.png') };
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
