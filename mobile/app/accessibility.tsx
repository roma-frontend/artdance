import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

/**
 * Страница доступности. Зеркалит веб `/accessibility`: заголовок и текст из словаря.
 * Экран публичный, поэтому открывается и без входа (см. `openLink` в `_layout.tsx`).
 */
export default function AccessibilityScreen() {
  const c = catalogFor(deviceLocale(undefined));
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.title]} numberOfLines={2}>
          {c.footer.accessibility}
        </Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={type.bodySm}>{c.footer.accessibilityNote}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  title: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
});
