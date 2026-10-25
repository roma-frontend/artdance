import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Collapsible } from '@/components/ui/collapsible';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { getFaq, type FaqGroup } from '@/lib/content';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { animateNextLayout, enterItem } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

export default function FaqScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<FaqGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getFaq(locale)
      .then((next) => {
        if (alive) setGroups(next);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  if (groups === null && !failed) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.footer.faq}</Text>
      </View>

      {failed ? (
        <EmptyState icon="alert-circle-outline" title={t.catalogError} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {(groups ?? []).map((group, groupIndex) => (
            <Animated.View key={group.id} entering={enterItem(groupIndex)} style={styles.group}>
              <Text style={type.h3}>{group.title}</Text>
              {group.items.map((item, index) => {
                const key = `${group.id}-${index}`;
                const open = openKey === key;
                return (
                  <View key={key} style={styles.card}>
                    <PressableScale
                      onPress={() => {
                        animateNextLayout();
                        setOpenKey(open ? null : key);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      style={styles.questionRow}
                    >
                      <Text style={[type.label, styles.question]}>{item.question}</Text>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.metal} />
                    </PressableScale>
                    <Collapsible open={open}>
                      <Text style={[type.bodySm, styles.answer]}>{item.answer}</Text>
                    </Collapsible>
                  </View>
                );
              })}
            </Animated.View>
          ))}

          <Animated.View entering={enterItem(groups?.length ?? 0)} style={styles.card}>
            <Text style={type.h3}>{c.help.stillStuck.title}</Text>
            <Text style={type.bodySm}>{c.help.stillStuck.body}</Text>
            <PressableScale onPress={() => router.push('/contact')} accessibilityRole="button">
              <Text style={[type.label, styles.cta]}>{c.help.stillStuck.cta}</Text>
            </PressableScale>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.xl },
  group: { gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  questionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  question: { flex: 1 },
  answer: { marginTop: space.xs },
  cta: { color: colors.accentBright, marginTop: space.xs },
});
