import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { getPricing, type PricingComparisonCell, type PricingContent } from '@/lib/content';
import { serverMessageOf } from '@/lib/server-message';
import { webUrl } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors, radius, space, type } from '@/theme';

export default function PricingScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<PricingContent | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPricing(locale)
      .then((next) => {
        if (alive) setContent(next);
      })
      .catch((error: unknown) => {
        if (alive) setFailed(serverMessageOf(error) ?? t.catalogError);
      });
    return () => {
      alive = false;
    };
  }, [locale, t.catalogError]);

  if (content === null && failed === null) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  function openWeb(path: string) {
    Linking.openURL(webUrl(locale, path)).catch(() => undefined);
  }

  const plans = content?.plans ?? null;
  const classPasses = content?.classPasses ?? null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{content?.title ?? ''}</Text>
      </View>

      {content === null ? (
        <EmptyState icon="alert-circle-outline" title={failed ?? t.catalogError} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {content.eyebrow ? <Text style={type.caption}>{content.eyebrow}</Text> : null}
          {content.subtitle ? <Text style={type.bodySm}>{content.subtitle}</Text> : null}

          {plans ? (
            <>
              {plans.items.map((plan) => (
                <View key={plan.id} style={[styles.card, plan.highlighted && styles.highlighted]}>
                  {plan.badges.length > 0 ? (
                    <View style={styles.chips}>
                      {plan.badges.map((badge) => (
                        <View key={badge} style={styles.chip}>
                          <Text style={type.caption}>{badge}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={type.title}>{plan.name}</Text>
                  <Text style={type.bodySm}>{plan.description}</Text>
                  <Text style={type.h2}>
                    {plan.price} {plan.priceUnit}
                  </Text>
                  <Text style={type.caption}>
                    {plan.yearlyNote} {plan.yearlySave}
                  </Text>
                  <Text style={type.label}>{plans.includedTitle}</Text>
                  {plan.features.map((feature) => (
                    <Text key={feature} style={type.bodySm}>
                      {feature}
                    </Text>
                  ))}
                  <PressableScale onPress={() => openWeb(content.webPath)} accessibilityRole="button">
                    <Text style={[type.label, styles.cta]}>{plan.cta}</Text>
                  </PressableScale>
                </View>
              ))}
              <Text style={type.caption}>{plans.note}</Text>

              <View style={styles.card}>
                <Text style={type.h3}>{plans.comparison.title}</Text>
                <Text style={type.bodySm}>{plans.comparison.subtitle}</Text>
                {plans.comparison.rows.map((row) => (
                  <View key={row.id} style={styles.row}>
                    <Text style={type.label}>{row.label}</Text>
                    {plans.comparison.plans.map((plan, index) => (
                      <View key={plan.id} style={styles.cellLine}>
                        <Text style={type.caption}>{plan.name}</Text>
                        <CellValue cell={row.cells[index]} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {classPasses ? (
            <>
              <Text style={type.h3}>{classPasses.title}</Text>
              <Text style={type.bodySm}>{classPasses.subtitle}</Text>
              {classPasses.items.map((pass) => (
                <View key={pass.id} style={styles.card}>
                  {pass.badge ? (
                    <View style={styles.chip}>
                      <Text style={type.caption}>{pass.badge}</Text>
                    </View>
                  ) : null}
                  <Text style={type.title}>{pass.lessonsLabel}</Text>
                  <Text style={type.caption}>{pass.validityLabel}</Text>
                  <Text style={type.bodySm}>{pass.perLesson}</Text>
                  <PressableScale onPress={() => openWeb(content.webPath)} accessibilityRole="button">
                    <Text style={[type.label, styles.cta]}>{pass.cta}</Text>
                  </PressableScale>
                </View>
              ))}
            </>
          ) : null}

          <View style={styles.card}>
            <Text style={type.h3}>{content.payAsYouGo.title}</Text>
            <Text style={type.bodySm}>{content.payAsYouGo.body}</Text>
            {content.payAsYouGo.planNote ? <Text style={type.caption}>{content.payAsYouGo.planNote}</Text> : null}
            <PressableScale onPress={() => openWeb(content.payAsYouGo.path)} accessibilityRole="button">
              <Text style={[type.label, styles.cta]}>{content.payAsYouGo.cta}</Text>
            </PressableScale>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function CellValue({ cell }: { cell: PricingComparisonCell | undefined }) {
  if (!cell) return null;
  if (cell.state === 'text') return <Text style={type.bodySm}>{cell.text}</Text>;
  const yes = cell.state === 'yes';
  return (
    <View style={styles.inline}>
      <Ionicons name={yes ? 'checkmark' : 'close'} size={16} color={yes ? colors.accentBright : colors.text} />
      <Text style={type.bodySm}>{cell.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  highlighted: { borderWidth: 1, borderColor: colors.accentBright },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  row: { gap: space.xs, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  cellLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  cta: { color: colors.accentBright, marginTop: space.xs },
});
