import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gradients, radius } from '@/theme';

export const SHARE_CARD_SIZE = 1080;

type Props = {
  title: string;
  meta: string;
  eyebrow: string;
  brand: string;
  uri?: string;
  price?: string;
};

/**
 * Карточка для шеринга: рисуется в фиксированном размере 1080×1080 вне экрана
 * и снимается в PNG через react-native-view-shot. Размер фиксирован, поэтому
 * картинка одинаковая на любом телефоне.
 */
export const ShareCard = forwardRef<ComponentRef<typeof View>, Props>(function ShareCard({ title, meta, eyebrow, brand, uri, price }, ref) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient colors={['#3A1520', '#140C0F']} style={StyleSheet.absoluteFill} />
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <LinearGradient colors={gradients.heroShade} locations={[0.3, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.top}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Ionicons name="musical-notes" size={44} color={colors.metal} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={3}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {meta}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.brand}>{brand}</Text>
          {price ? (
            <View style={styles.price}>
              <Text style={styles.priceText}>{price}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_SIZE,
    height: SHARE_CARD_SIZE,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    padding: 72,
    justifyContent: 'space-between',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 36, fontWeight: '700', letterSpacing: 6, color: colors.metal, textTransform: 'uppercase' },
  body: { gap: 28, borderRadius: radius.xl },
  title: { fontFamily: fonts.display, fontSize: 116, lineHeight: 124, color: colors.text },
  meta: { fontSize: 44, lineHeight: 56, color: colors.text2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  brand: { fontFamily: fonts.displayItalic, fontSize: 52, color: colors.accentBright },
  price: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: radius.pill, backgroundColor: 'rgba(245,241,234,0.95)' },
  priceText: { fontSize: 40, fontWeight: '800', color: colors.bg },
});
