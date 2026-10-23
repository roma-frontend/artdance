import { type StyleProp, type ViewStyle, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BRAND_LOGO_LAYERS, BRAND_LOGO_VIEWBOX } from '@/components/brand-logo-paths';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

/** Исходник логотипа 1151×389 (вариант для тёмного фона). */
const BRAND_LOGO_RATIO = 1151 / 389;

export function brandLogoHeight(width: number): number {
  return width / BRAND_LOGO_RATIO;
}

type Props = { width: number; style?: StyleProp<ViewStyle> };

export function BrandLogo({ width, style }: Props) {
  const t = catalogFor(deviceLocale(undefined));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t.brand.name}
      style={[{ width, height: brandLogoHeight(width) }, style]}
    >
      <Svg width={width} height={brandLogoHeight(width)} viewBox={BRAND_LOGO_VIEWBOX}>
        {BRAND_LOGO_LAYERS.map((layer) => (
          <Path key={layer.fill} d={layer.d} fill={layer.fill} />
        ))}
      </Svg>
    </View>
  );
}
