import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, AppState, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AnimatedBackground } from '@/components/animated-background';
import { SupportLockView } from '@/components/support/lock-view';
import { CountUp, GlassCard, PulseDot, ShieldOrb } from '@/components/support/visuals';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Segmented } from '@/components/ui/segmented';
import { catalogFor } from '@/i18n/catalog';
import { refreshEntitlements } from '@/lib/entitlements';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT, enterCard3D } from '@/lib/motion';
import { backLabel, goBack } from '@/lib/navigation';
import {
  getSupportSnapshot,
  releaseSupportPayout,
  setSupportOverride,
  setSupportPreset,
  setSupportTicketStatus,
  SupportApiError,
  type SupportSnapshot,
} from '@/lib/support';
import { authenticateBiometric, biometricAvailable, hasPin, PIN_LENGTH, setPin, verifyPin } from '@/lib/support-lock';
import { accentGlow, colors, gradients, radius, space, type } from '@/theme';

const tabs = ['overview', 'queue', 'entitlements', 'payouts', 'integrations'] as const;
type Tab = (typeof tabs)[number];

const presets = ['mvp', 'full', 'premium'] as const;

/** create/repeat: первичная установка PIN; locked: вход; unlocked: данные загружаются. */
type LockPhase = 'checking' | 'create' | 'repeat' | 'locked' | 'unlocked';

/** Support Command Center: только для операторов. Доступ проверяется сервером, экран закрыт PIN или биометрией. */
export default function SupportCommandCenterScreen() {
  const insets = useSafeAreaInsets();
  const c = catalogFor(deviceLocale(undefined));
  const m = c.admin.support.mobile;
  const [phase, setPhase] = useState<LockPhase>('checking');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [pinBuffer, setPinBuffer] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [tab, setTab] = useState<Tab>('overview');
  const [snapshot, setSnapshot] = useState<SupportSnapshot | null>(null);
  const [pendingFeatures, setPendingFeatures] = useState<Record<string, boolean>>({});
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const bioBusy = useRef(false);

  const tabLabels: Record<Tab, string> = {
    overview: m.tabOverview,
    queue: m.tabQueue,
    entitlements: m.tabEntitlements,
    payouts: m.tabPayouts,
    integrations: m.tabIntegrations,
  };

  const load = useCallback(async () => {
    try {
      const next = await getSupportSnapshot();
      setSnapshot(next);
      setPendingFeatures({});
      setDenied(false);
      setLoadError(false);
    } catch (error) {
      if (error instanceof SupportApiError && (error.status === 401 || error.status === 403)) {
        setDenied(true);
      } else {
        setLoadError(true);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const unlock = useCallback(() => {
    setLockMessage(null);
    setPhase('unlocked');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  // Блокировка при уходе в фон и по кнопке оператора; снимок стирается из памяти.
  const relock = useCallback(() => {
    setPhase((prev) => (prev === 'unlocked' ? 'locked' : prev));
    setSnapshot(null);
    setTab('overview');
    setPinBuffer('');
    setLockMessage(null);
  }, []);

  // Первый вход: без PIN сначала создаём его (обязателен всегда), биометрия только дополняет.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [pinSet, bio] = await Promise.all([hasPin(), biometricAvailable()]);
      if (!alive) return;
      setBioAvailable(bio);
      setPhase(pinSet ? 'locked' : 'create');
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Только фон: Face ID переводит приложение в inactive и не должен блокировать экран.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') relock();
    });
    return () => subscription.remove();
  }, [relock]);

  // Один запрос за раз; отмена оставляет экран PIN, сбой показывает подсказку.
  const tryBiometric = useCallback(async () => {
    if (bioBusy.current) return;
    bioBusy.current = true;
    try {
      const outcome = await authenticateBiometric(m.biometricPrompt);
      if (outcome === 'ok') unlock();
      else if (outcome === 'failed') setLockMessage(m.biometricFailed);
    } finally {
      bioBusy.current = false;
    }
  }, [m.biometricPrompt, m.biometricFailed, unlock]);

  useEffect(() => {
    if (phase === 'locked' && bioAvailable) void tryBiometric();
  }, [phase, bioAvailable, tryBiometric]);

  // Данные загружаются только после разблокировки.
  useEffect(() => {
    if (phase === 'unlocked') void load();
  }, [phase, load]);

  const handlePinComplete = useCallback(
    async (pin: string) => {
      if (phase === 'create') {
        setPendingPin(pin);
        setPinBuffer('');
        setLockMessage(null);
        setPhase('repeat');
        return;
      }
      if (phase === 'repeat') {
        setPinBuffer('');
        if (pin !== pendingPin) {
          setPendingPin('');
          setLockMessage(m.pinMismatch);
          setShakeKey((k) => k + 1);
          setPhase('create');
          return;
        }
        await setPin(pin);
        setPendingPin('');
        unlock();
        return;
      }
      if (phase === 'locked') {
        const result = await verifyPin(pin);
        setPinBuffer('');
        if (result === 'ok') {
          unlock();
          return;
        }
        setLockMessage(result === 'locked' ? m.pinLocked : m.pinWrong);
        setShakeKey((k) => k + 1);
      }
    },
    [phase, pendingPin, unlock, m.pinMismatch, m.pinLocked, m.pinWrong],
  );

  useEffect(() => {
    if (pinBuffer.length === PIN_LENGTH) void handlePinComplete(pinBuffer);
  }, [pinBuffer, handlePinComplete]);

  /** Каждое действие: вибрация-предупреждение, подтверждение, запрос, перезагрузка снимка. */
  const run = useCallback(
    (title: string, message: string, action: () => Promise<unknown>) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      Alert.alert(title, message, [
        { text: m.cancel, style: 'cancel' },
        {
          text: m.confirm,
          onPress: async () => {
            try {
              await action();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              refreshEntitlements();
              await load();
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
              Alert.alert(m.actionFailed, error instanceof Error ? error.message : m.unknownError);
            }
          },
        },
      ]);
    },
    [load, m.cancel, m.confirm, m.actionFailed, m.unknownError],
  );

  if (phase === 'checking') {
    return (
      <View style={[styles.screen, styles.center]}>
        <AnimatedBackground />
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  if (phase !== 'unlocked') {
    const title = phase === 'create' ? m.createPinTitle : phase === 'repeat' ? m.repeatPinTitle : m.lockTitle;
    const hint = phase === 'create' ? m.createPinHint : phase === 'repeat' ? m.repeatPinHint : m.lockHint;
    return (
      <SupportLockView
        title={title}
        hint={hint}
        pinLength={PIN_LENGTH}
        filled={pinBuffer.length}
        message={lockMessage}
        shakeKey={shakeKey}
        bioAvailable={bioAvailable && phase === 'locked'}
        bioLabel={m.useBiometric}
        deleteLabel={m.pinDelete}
        backLabel={backLabel()}
        onBack={() => goBack()}
        onDigit={(digit) => setPinBuffer((prev) => (prev.length < PIN_LENGTH ? prev + digit : prev))}
        onDelete={() => setPinBuffer((prev) => prev.slice(0, -1))}
        onBiometric={() => void tryBiometric()}
      />
    );
  }

  const header = (
    <CommandHeader
      eyebrow={c.admin.support.operatorMode}
      title={c.admin.support.title}
      backLabel={backLabel()}
      lockLabel={m.lockTitle}
      onBack={() => goBack()}
      onLock={relock}
    />
  );

  if (denied) {
    return (
      <View style={styles.screen}>
        <AnimatedBackground />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl }}>
          {header}
          <EmptyState icon="lock-closed-outline" title={m.noAccess} />
        </ScrollView>
      </View>
    );
  }

  if (!snapshot) {
    return (
      <View style={[styles.screen, styles.center]}>
        <AnimatedBackground />
        {loadError ? (
          <PressableScale onPress={() => void load()} accessibilityRole="button">
            <Text style={type.h3}>{m.retry}</Text>
          </PressableScale>
        ) : (
          <ActivityIndicator color={colors.accentBright} />
        )}
      </View>
    );
  }

  const canManage = snapshot.canManageEntitlements;
  const statEntries = Object.entries({ ...snapshot.pulse.stats, ...snapshot.pulse.counts });

  return (
    <View style={styles.screen}>
      <AnimatedBackground />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accentBright} />}
      >
        {header}

        <View style={styles.segmentWrap}>
          <Segmented
            scrollable
            options={tabs.map((key) => ({ key, label: tabLabels[key] }))}
            value={tab}
            onChange={setTab}
          />
        </View>

        <Animated.View key={tab} entering={FadeIn.duration(260).easing(EASE_OUT)} style={styles.body}>
          {tab === 'overview' ? (
            <>
              <Animated.View entering={FadeInDown.duration(480).easing(EASE_OUT)}>
                <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, accentGlow]}>
                  <View style={styles.heroCopy}>
                    <View style={styles.eyebrowRow}>
                      <PulseDot color={colors.white} size={7} />
                      <Text style={[type.eyebrow, styles.heroEyebrow]}>{c.admin.support.allCapabilities}</Text>
                    </View>
                    <Text style={[type.h2, styles.heroTitle]}>{c.admin.support.godModeActive}</Text>
                  </View>
                  <ShieldOrb size={76} />
                </LinearGradient>
              </Animated.View>

              <View style={styles.grid}>
                {statEntries.map(([key, value], index) => (
                  <Animated.View key={key} entering={enterCard3D(index)} style={[styles.statWrap, index === 0 && styles.statWide]}>
                    <GlassCard style={styles.stat}>
                      {typeof value === 'number' ? (
                        <CountUp value={value} style={index === 0 ? { ...type.h2, ...styles.statValueWide } : type.h2} />
                      ) : (
                        <Text style={type.h2}>{String(value)}</Text>
                      )}
                      <Text style={[type.eyebrow, styles.statLabel]} numberOfLines={2}>
                        {humanize(key)}
                      </Text>
                    </GlassCard>
                  </Animated.View>
                ))}
              </View>
            </>
          ) : null}

        {tab === 'queue' ? (
          snapshot.tickets.length === 0 ? (
            <EmptyState icon="checkmark-done-outline" title={m.noTickets} />
          ) : (
            snapshot.tickets.map((ticket, index) => {
              const tint = statusTint(ticket.status);
              return (
                <Animated.View key={ticket.id} entering={enterCard3D(index)}>
                  <GlassCard style={styles.card}>
                    <View style={[styles.stripe, { backgroundColor: tint }]} />
                    <View style={styles.cardHead}>
                      <Text style={[type.h3, styles.flex]} numberOfLines={2}>
                        {ticket.topic}
                      </Text>
                      <StatusPill label={ticket.status} tint={tint} />
                    </View>
                    <Text style={type.bodySm}>{ticket.name}</Text>
                    <Text style={type.bodySm} numberOfLines={3}>
                      {ticket.message}
                    </Text>
                    <View style={styles.row}>
                      {ticket.status !== 'RESOLVED' ? (
                        <ActionButton
                          variant="primary"
                          label={m.resolve}
                          onPress={() => run(m.resolveTicket, ticket.topic, () => setSupportTicketStatus(ticket.id, 'RESOLVED'))}
                        />
                      ) : null}
                      {ticket.status === 'OPEN' ? (
                        <ActionButton
                          label={m.markPending}
                          onPress={() => run(m.setPending, ticket.topic, () => setSupportTicketStatus(ticket.id, 'PENDING'))}
                        />
                      ) : null}
                    </View>
                  </GlassCard>
                </Animated.View>
              );
            })
          )
        ) : null}

        {tab === 'entitlements' ? (
          <>
            <Text style={[type.eyebrow, styles.sectionLabel]}>{m.presetLabel}</Text>
            <GlassCard style={styles.presetRow}>
              {presets.map((preset) => (
                <ActionButton
                  key={preset}
                  variant={snapshot.entitlements.preset === preset ? 'primary' : 'ghost'}
                  label={preset}
                  disabled={!canManage}
                  onPress={() => run(m.changePreset, preset, () => setSupportPreset(preset))}
                />
              ))}
            </GlassCard>
            {snapshot.entitlements.features.map((feature, index) => (
              <Animated.View key={feature.key} entering={enterCard3D(index)}>
                <GlassCard style={styles.featureRow}>
                  <View style={styles.flex}>
                    <Text style={type.h3} numberOfLines={1}>
                      {feature.key}
                    </Text>
                    <Text style={type.bodySm}>
                      {feature.group} · {feature.tier}
                      {feature.overridden ? ` · ${m.overridden}` : ''}
                    </Text>
                  </View>
                  {feature.overridden && canManage ? (
                    <ActionButton label={m.reset} onPress={() => run(m.resetOverride, feature.key, () => setSupportOverride(feature.key, null))} />
                  ) : null}
                  <Switch
                    value={pendingFeatures[feature.key] ?? feature.enabled}
                    disabled={!canManage}
                    trackColor={{ false: 'rgba(245,241,234,0.16)', true: colors.accentBright }}
                    thumbColor={colors.white}
                    ios_backgroundColor="rgba(245,241,234,0.16)"
                    onValueChange={(next) =>
                      run(m.changeFeature, `${feature.key}: ${next ? m.on : m.off}`, async () => {
                        setPendingFeatures((prev) => ({ ...prev, [feature.key]: next }));
                        try {
                          await setSupportOverride(feature.key, next);
                        } catch (error) {
                          setPendingFeatures((prev) => {
                            const { [feature.key]: _reverted, ...rest } = prev;
                            return rest;
                          });
                          throw error;
                        }
                      })
                    }
                  />
                </GlassCard>
              </Animated.View>
            ))}
          </>
        ) : null}

        {tab === 'payouts' ? (
          snapshot.payouts.length === 0 ? (
            <EmptyState icon="wallet-outline" title={m.noPayouts} />
          ) : (
            snapshot.payouts.map((payout, index) => {
              const tint = payout.failureReason ? colors.danger : payout.status === 'ON_HOLD' ? colors.metal : colors.success;
              return (
                <Animated.View key={payout.id} entering={enterCard3D(index)}>
                  <GlassCard style={styles.card}>
                    <View style={[styles.stripe, { backgroundColor: tint }]} />
                    <View style={styles.cardHead}>
                      <Text style={[type.h2, styles.flex]}>
                        {payout.amount} <Text style={type.caption}>{payout.currencyCode}</Text>
                      </Text>
                      <StatusPill label={payout.status} tint={tint} />
                    </View>
                    <Text style={type.bodySm}>{payout.reference}</Text>
                    {payout.failureReason ? <Text style={[type.bodySm, { color: colors.danger }]}>{payout.failureReason}</Text> : null}
                    <View style={styles.row}>
                      {payout.status !== 'ON_HOLD' ? (
                        <ActionButton label={m.hold} onPress={() => run(m.holdPayout, payout.reference, () => releaseSupportPayout(payout.id, true))} />
                      ) : null}
                      <ActionButton
                        variant="primary"
                        label={m.release}
                        onPress={() => run(m.releasePayout, `${payout.amount} ${payout.currencyCode}`, () => releaseSupportPayout(payout.id, false))}
                      />
                    </View>
                  </GlassCard>
                </Animated.View>
              );
            })
          )
        ) : null}

        {tab === 'integrations' ? (
          snapshot.integrations.map((item, index) => (
            <Animated.View key={item.key} entering={enterCard3D(index)}>
              <GlassCard style={styles.featureRow}>
                <View style={[styles.providerTile, { borderColor: item.connected ? colors.success : colors.lineStrong }]}>
                  <Text style={[type.title, { color: item.connected ? colors.success : colors.text3 }]}>
                    {item.provider.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={type.h3} numberOfLines={1}>
                    {item.key}
                  </Text>
                  <Text style={type.bodySm}>{item.provider}</Text>
                </View>
                <Ionicons
                  name={item.connected ? 'checkmark-circle' : 'close-circle-outline'}
                  size={24}
                  color={item.connected ? colors.success : colors.text3}
                />
              </GlassCard>
            </Animated.View>
          ))
        ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function CommandHeader({
  eyebrow,
  title,
  backLabel: back,
  lockLabel,
  onBack,
  onLock,
}: {
  eyebrow: string;
  title: string;
  backLabel: string;
  lockLabel: string;
  onBack: () => void;
  onLock: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel={back}>
        <View style={styles.iconButton}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </View>
      </PressableScale>
      <View style={styles.flex}>
        <View style={styles.eyebrowRow}>
          <PulseDot size={7} />
          <Text style={type.eyebrow}>{eyebrow}</Text>
        </View>
        <Text style={type.h2} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <PressableScale onPress={onLock} accessibilityRole="button" accessibilityLabel={lockLabel}>
        <View style={[styles.iconButton, styles.lockButton]}>
          <Ionicons name="lock-closed" size={18} color={colors.accentText} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function StatusPill({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.pill, { borderColor: tint, backgroundColor: `${tint}22` }]}>
      <Text style={[type.caption, styles.pillText, { color: tint }]}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  variant = 'ghost',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const text = <Text style={[type.bodySm, styles.buttonText, variant === 'primary' && styles.buttonTextPrimary]}>{label}</Text>;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      pressedScale={0.94}
      style={disabled ? styles.disabled : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btn, accentGlow]}>
          {text}
        </LinearGradient>
      ) : (
        <View style={[styles.btn, styles.btnGhost]}>{text}</View>
      )}
    </PressableScale>
  );
}

function statusTint(status: string): string {
  if (status === 'RESOLVED') return colors.success;
  if (status === 'PENDING') return colors.metal;
  return colors.accentBright;
}

/** Ключи статистики приходят с сервера в camelCase: превращаем в читаемую подпись. */
function humanize(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,241,234,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  lockButton: { backgroundColor: colors.accentSoft, borderColor: 'rgba(201,59,82,0.4)' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  segmentWrap: { paddingBottom: space.md },
  body: { paddingHorizontal: space.xl, gap: space.md },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.xl,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  heroCopy: { flex: 1, gap: space.sm, paddingRight: space.md },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)' },
  heroTitle: { color: colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  statWrap: { width: '48%' },
  statWide: { width: '100%' },
  stat: { padding: space.lg, gap: space.xs, minHeight: 112, justifyContent: 'space-between' },
  statValueWide: { fontSize: 40, lineHeight: 46 },
  statLabel: { color: colors.metal },
  card: { padding: space.lg, paddingLeft: space.xl + space.xs, gap: space.sm },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  pill: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  pillText: { fontWeight: '700', letterSpacing: 0.6 },
  btn: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, overflow: 'hidden' },
  btnGhost: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, backgroundColor: 'rgba(245,241,234,0.05)' },
  buttonText: { color: colors.text, fontWeight: '700' },
  buttonTextPrimary: { color: colors.white },
  disabled: { opacity: 0.4 },
  sectionLabel: { color: colors.metal, marginTop: space.sm },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  providerTile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,241,234,0.04)',
  },
});
