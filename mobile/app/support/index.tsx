import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, AppState, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
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
import { EASE_OUT } from '@/lib/motion';
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
type IconName = ComponentProps<typeof Ionicons>['name'];
type MetricTone = 'accent' | 'warning' | 'success' | 'neutral';

/** create/repeat: первичная установка PIN; locked: вход; unlocked: данные загружаются. */
type LockPhase = 'checking' | 'create' | 'repeat' | 'locked' | 'unlocked';

/** Command center: только для операторов. Доступ проверяется сервером, экран закрыт PIN или биометрией. */
export default function SupportCommandCenterScreen() {
  const insets = useSafeAreaInsets();
  const c = catalogFor(deviceLocale(undefined));
  const m = c.admin.support.mobile;
  const support = c.admin.support;
  const god = support.god;
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
      eyebrow={support.operatorMode}
      title={support.title}
      liveLabel={god.livePoll}
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
    return <LoadingView title={support.title} eyebrow={support.operatorMode} liveLabel={god.livePoll} retryLabel={m.retry} error={loadError} onRetry={() => void load()} />;
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
            options={tabs.map((key) => ({
              key,
              label: key === 'queue' && snapshot.pulse.openTickets > 0 ? `${tabLabels[key]} · ${snapshot.pulse.openTickets}` : tabLabels[key],
            }))}
            value={tab}
            onChange={setTab}
          />
        </View>

        <Animated.View key={tab} entering={FadeIn.duration(260).easing(EASE_OUT)} style={styles.body}>
          {tab === 'overview' ? (
            <>
              <CommandHero
                title={support.godModeActive}
                subtitle={god.heroSubtitle}
                liveLabel={god.livePoll}
                capabilitiesLabel={support.allCapabilities}
                allowlistLabel={god.allowlistBadge}
                auditedLabel={god.auditedBadge}
                openTickets={snapshot.pulse.openTickets}
                users={snapshot.pulse.stats.users}
                bookings={snapshot.pulse.stats.bookings}
                revenue={snapshot.pulse.stats.revenue}
                openLabel={god.openTicketsLabel}
                platformLabel={god.platformLabel}
                paidLabel={god.paidLabel}
              />

              <SectionIntro title={god.overviewTitle} hint={god.overviewHint} icon="pulse-outline" />

              <View style={styles.metricGrid}>
                {[
                  {
                    key: 'sessions',
                    value: snapshot.pulse.counts.sessions,
                    label: god.kpiActiveSessions,
                    sub: god.kpiActiveSessionsSub,
                    icon: 'radio-outline' as IconName,
                    tone: 'success' as MetricTone,
                  },
                  {
                    key: 'failedPayments',
                    value: snapshot.pulse.counts.failedPayments,
                    label: god.kpiFailedPayments,
                    sub: god.kpiFailedPaymentsSub,
                    icon: 'card-outline' as IconName,
                    tone: snapshot.pulse.counts.failedPayments > 0 ? 'warning' as MetricTone : 'success' as MetricTone,
                  },
                  {
                    key: 'openTickets',
                    value: snapshot.pulse.openTickets,
                    label: god.kpiOpenTickets,
                    sub: `${snapshot.pulse.pendingTickets} ${god.kpiOpenSuffix}`,
                    icon: 'chatbubble-ellipses-outline' as IconName,
                    tone: 'accent' as MetricTone,
                  },
                  {
                    key: 'pendingApprovals',
                    value: snapshot.pulse.counts.pendingApprovals,
                    label: god.kpiPendingApprovals,
                    sub: god.kpiPendingApprovalsSub,
                    icon: 'shield-checkmark-outline' as IconName,
                    tone: snapshot.pulse.counts.pendingApprovals > 0 ? 'warning' as MetricTone : 'success' as MetricTone,
                  },
                ].map(({ key, ...metric }, index) => (
                  <PulseMetricCard key={key} {...metric} index={index} />
                ))}
              </View>

              <HealthStrip
                integrations={snapshot.integrations}
                label={god.healthLabel}
                lastSync={god.lastSync.replace('{time}', relativeTime(snapshot.pulse.timestamp, god))}
                connectedLabel={god.allSystemsOperational}
              />

              <QueuePreview
                tickets={snapshot.tickets}
                title={support.queueTitle}
                hint={support.queueHint}
                emptyLabel={m.noTickets}
                openLabel={m.tabQueue}
                statusLabel={(status) => statusLabel(status, support.status)}
                onOpen={() => setTab('queue')}
              />

              <SectionIntro title={god.platformLabel} hint={support.subtitle} icon="bar-chart-outline" />
              <View style={styles.grid}>
                {statEntries.map(([key, value], index) => (
                  <Animated.View key={key} entering={enterOperatorCard(index)} style={styles.statWrap}>
                    <GlassCard style={styles.stat}>
                      {typeof value === 'number' ? <CountUp value={value} style={type.h2} /> : <Text style={type.h2}>{String(value)}</Text>}
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
          <>
            <SectionIntro title={support.queueTitle} hint={support.queueHint} icon="chatbubbles-outline" />
            {snapshot.tickets.length === 0 ? (
              <EmptyState icon="checkmark-done-outline" title={m.noTickets} />
            ) : (
              snapshot.tickets.map((ticket, index) => {
              const tint = statusTint(ticket.status);
              return (
                <Animated.View key={ticket.id} entering={enterOperatorCard(index)}>
                  <GlassCard style={styles.card}>
                    <View style={[styles.stripe, { backgroundColor: tint }]} />
                    <View style={styles.cardHead}>
                      <Text style={[type.h3, styles.flex]} numberOfLines={2}>
                        {ticket.topic}
                      </Text>
                      <StatusPill label={statusLabel(ticket.status, support.status)} tint={tint} />
                    </View>
                    <Text style={type.bodySm}>{ticket.name}</Text>
                    <Text style={type.bodySm} numberOfLines={3}>
                      {ticket.message}
                    </Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={14} color={colors.text3} />
                      <Text style={type.caption}>{relativeTime(ticket.createdAt, god)}</Text>
                      <Text style={[type.caption, styles.metaDot]}>·</Text>
                      <Text style={type.caption}>{formatShortDate(ticket.createdAt)}</Text>
                    </View>
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
            )}
          </>
        ) : null}

        {tab === 'entitlements' ? (
          <>
            <SectionIntro title={support.featuresTitle} hint={support.featuresHint} icon="options-outline" />
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
              <Animated.View key={feature.key} entering={enterOperatorCard(index)}>
                <GlassCard style={styles.featureRow}>
                  <View style={[styles.featureIcon, { backgroundColor: feature.enabled ? colors.accentSoft : 'rgba(245,241,234,0.05)' }]}>
                    <Ionicons name={featureIcon(feature.group)} size={18} color={feature.enabled ? colors.accentText : colors.text3} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={type.h3} numberOfLines={1}>
                      {feature.key}
                    </Text>
                    <Text style={type.bodySm}>
                      {groupLabel(feature.group, m)} · {feature.tier}
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
          <>
            <SectionIntro title={m.tabPayouts} hint={m.noPayouts} icon="wallet-outline" />
            {snapshot.payouts.length === 0 ? (
              <EmptyState icon="wallet-outline" title={m.noPayouts} />
            ) : (
              snapshot.payouts.map((payout, index) => {
              const tint = payout.failureReason ? colors.danger : payout.status === 'ON_HOLD' ? colors.metal : colors.success;
              return (
                <Animated.View key={payout.id} entering={enterOperatorCard(index)}>
                  <GlassCard style={styles.card}>
                    <View style={[styles.stripe, { backgroundColor: tint }]} />
                    <View style={styles.cardHead}>
                      <Text style={[type.h2, styles.flex]}>
                        {payout.amount} <Text style={type.caption}>{payout.currencyCode}</Text>
                      </Text>
                      <StatusPill label={payout.status} tint={tint} />
                    </View>
                    <Text style={type.bodySm}>{payout.reference}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="calendar-outline" size={14} color={colors.text3} />
                      <Text style={type.caption}>{formatShortDate(payout.periodEnd)}</Text>
                    </View>
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
            )}
          </>
        ) : null}

        {tab === 'integrations' ? (
          <>
            <SectionIntro title={m.tabIntegrations} hint={support.toolsHint} icon="git-network-outline" />
            {snapshot.integrations.map((item, index) => (
              <Animated.View key={item.key} entering={enterOperatorCard(index)}>
                <GlassCard style={styles.featureRow}>
                  <View
                    style={[
                      styles.providerTile,
                      {
                        borderColor: item.connected ? colors.success : colors.lineStrong,
                        backgroundColor: item.connected ? 'rgba(63,185,132,0.10)' : 'rgba(245,241,234,0.04)',
                      },
                    ]}
                  >
                    <Ionicons name={integrationIcon(item.key)} size={20} color={item.connected ? colors.success : colors.text3} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={type.h3} numberOfLines={1}>
                      {item.key}
                    </Text>
                    <Text style={type.bodySm}>{item.provider}</Text>
                  </View>
                  <View style={styles.integrationStatus}>
                    <PulseDot color={item.connected ? colors.success : colors.text3} size={7} />
                    <Ionicons
                      name={item.connected ? 'checkmark-circle' : 'close-circle-outline'}
                      size={22}
                      color={item.connected ? colors.success : colors.text3}
                    />
                  </View>
                </GlassCard>
              </Animated.View>
            ))}
          </>
        ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function CommandHeader({
  eyebrow,
  title,
  liveLabel,
  backLabel: back,
  lockLabel,
  onBack,
  onLock,
}: {
  eyebrow: string;
  title: string;
  liveLabel: string;
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
      <View style={styles.headerActions}>
        <View style={styles.headerLive}>
          <PulseDot color={colors.success} size={6} />
          <Text style={styles.headerLiveText}>{liveLabel}</Text>
        </View>
        <PressableScale onPress={onLock} accessibilityRole="button" accessibilityLabel={lockLabel}>
          <View style={[styles.iconButton, styles.lockButton]}>
            <Ionicons name="lock-closed" size={18} color={colors.accentText} />
          </View>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

function CommandHero({
  title,
  subtitle,
  liveLabel,
  capabilitiesLabel,
  allowlistLabel,
  auditedLabel,
  openTickets,
  users,
  bookings,
  revenue,
  openLabel,
  platformLabel,
  paidLabel,
}: {
  title: string;
  subtitle: string;
  liveLabel: string;
  capabilitiesLabel: string;
  allowlistLabel: string;
  auditedLabel: string;
  openTickets: number;
  users: number;
  bookings: number;
  revenue: number;
  openLabel: string;
  platformLabel: string;
  paidLabel: string;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(520).easing(EASE_OUT)}>
      <LinearGradient colors={['#321019', '#1D0E14', '#120A0D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, accentGlow]}>
        <View pointerEvents="none" style={styles.heroGlowTop} />
        <View pointerEvents="none" style={styles.heroGlowBottom} />
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroLiveBadge}>
                <PulseDot color={colors.success} size={7} />
                <Text style={styles.heroBadgeText}>GOD MODE · {liveLabel}</Text>
              </View>
            </View>
            <View style={styles.heroTitleRow}>
              <Text style={styles.heroTitle}>{title}</Text>
              <View style={styles.godTag}><Text style={styles.godTagText}>GOD</Text></View>
            </View>
            <Text style={styles.heroSubtitle}>{subtitle}</Text>
          </View>
          <ShieldOrb size={96} />
        </View>

        <View style={styles.heroChips}>
          <View style={styles.heroChip}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.success} />
            <Text style={styles.heroChipText} numberOfLines={1}>{capabilitiesLabel}</Text>
          </View>
          <View style={styles.heroChip}>
            <Ionicons name="finger-print-outline" size={13} color={colors.metal} />
            <Text style={styles.heroChipText} numberOfLines={1}>{allowlistLabel}</Text>
          </View>
          <View style={styles.heroChip}>
            <Ionicons name="document-text-outline" size={13} color={colors.accentText} />
            <Text style={styles.heroChipText} numberOfLines={1}>{auditedLabel}</Text>
          </View>
        </View>

        <View style={styles.heroStats}>
          <HeroMetric label={openLabel} value={openTickets} accent={colors.accentText} />
          <View style={styles.heroDivider} />
          <HeroMetric label={platformLabel} value={users} detail={`${bookings.toLocaleString()} bookings`} accent={colors.metal} />
          <View style={styles.heroDivider} />
          <HeroMetric label={paidLabel} value={revenue} formatted accent={colors.success} />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function HeroMetric({ label, value, detail, accent, formatted }: { label: string; value: number; detail?: string; accent: string; formatted?: boolean }) {
  return (
    <View style={styles.heroMetric}>
      <Text style={styles.heroMetricLabel} numberOfLines={1}>{label}</Text>
      {formatted ? <Text style={[styles.heroMetricValue, { color: accent }]} numberOfLines={1}>{formatMetric(value)}</Text> : <CountUp value={value} style={[styles.heroMetricValue, { color: accent }]} />}
      <Text style={styles.heroMetricDetail} numberOfLines={1}>{detail ?? 'live'}</Text>
    </View>
  );
}

function SectionIntro({ title, hint, icon }: { title: string; hint?: string; icon: IconName }) {
  return (
    <View style={styles.sectionIntro}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={colors.accentText} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint} numberOfLines={2}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function PulseMetricCard({
  value,
  label,
  sub,
  icon,
  tone,
  index,
}: {
  value: number;
  label: string;
  sub: string;
  icon: IconName;
  tone: MetricTone;
  index: number;
}) {
  const tint = metricTint(tone);
  return (
    <Animated.View entering={enterOperatorCard(index)} style={styles.metricWrap}>
      <GlassCard style={[styles.metricCard, { borderColor: `${tint}55` }]}>
        <View style={styles.metricTop}>
          <View style={[styles.metricIcon, { backgroundColor: `${tint}1F` }]}>
            <Ionicons name={icon} size={18} color={tint} />
          </View>
          <PulseDot color={tint} size={6} />
        </View>
        <CountUp value={value ?? 0} style={[styles.metricValue, { color: tint }]} />
        <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
        <Text style={styles.metricSub} numberOfLines={1}>{sub}</Text>
      </GlassCard>
    </Animated.View>
  );
}

function HealthStrip({
  integrations,
  label,
  lastSync,
  connectedLabel,
}: {
  integrations: SupportSnapshot['integrations'];
  label: string;
  lastSync: string;
  connectedLabel: string;
}) {
  const connected = integrations.filter((item) => item.connected).length;
  return (
    <GlassCard style={styles.healthCard}>
      <View style={styles.healthHead}>
        <View style={[styles.metricIcon, styles.healthIcon]}>
          <Ionicons name="pulse-outline" size={18} color={colors.success} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{label}</Text>
          <Text style={styles.sectionHint}>{lastSync}</Text>
        </View>
        <StatusPill label={`${connected}/${integrations.length}`} tint={connected === integrations.length ? colors.success : colors.metal} />
      </View>
      <View style={styles.healthGrid}>
        {integrations.map((item) => (
          <View key={item.key} style={styles.healthItem}>
            <Ionicons name={integrationIcon(item.key)} size={15} color={item.connected ? colors.success : colors.text3} />
            <View style={styles.flex}>
              <Text style={styles.healthItemLabel} numberOfLines={1}>{item.key}</Text>
              <Text style={styles.healthItemProvider} numberOfLines={1}>{item.provider}</Text>
            </View>
            <PulseDot color={item.connected ? colors.success : colors.text3} size={6} />
          </View>
        ))}
      </View>
      <View style={styles.healthFooter}>
        <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
        <Text style={styles.healthFooterText}>{connected === integrations.length ? connectedLabel : `${connected}/${integrations.length}`}</Text>
      </View>
    </GlassCard>
  );
}

function QueuePreview({
  tickets,
  title,
  hint,
  emptyLabel,
  openLabel,
  statusLabel: getStatusLabel,
  onOpen,
}: {
  tickets: SupportSnapshot['tickets'];
  title: string;
  hint: string;
  emptyLabel: string;
  openLabel: string;
  statusLabel: (status: string) => string;
  onOpen: () => void;
}) {
  return (
    <GlassCard style={styles.previewCard}>
      <View style={styles.previewHead}>
        <View style={[styles.metricIcon, styles.previewIcon]}>
          <Ionicons name="chatbubbles-outline" size={18} color={colors.accentText} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionHint} numberOfLines={1}>{hint}</Text>
        </View>
        <StatusPill label={`${tickets.length}`} tint={tickets.length ? colors.accentBright : colors.success} />
      </View>
      {tickets.length === 0 ? (
        <Text style={[type.bodySm, styles.previewEmpty]}>{emptyLabel}</Text>
      ) : (
        <View style={styles.previewList}>
          {tickets.slice(0, 3).map((ticket) => (
            <View key={ticket.id} style={styles.previewItem}>
              <View style={[styles.previewStatusDot, { backgroundColor: statusTint(ticket.status) }]} />
              <View style={styles.flex}>
                <Text style={styles.previewTopic} numberOfLines={1}>{ticket.topic}</Text>
                <Text style={styles.previewMeta} numberOfLines={1}>{ticket.name} · {getStatusLabel(ticket.status)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.text3} />
            </View>
          ))}
        </View>
      )}
      <ActionButton label={openLabel} onPress={onOpen} />
    </GlassCard>
  );
}

function LoadingView({
  title,
  eyebrow,
  liveLabel,
  retryLabel,
  error,
  onRetry,
}: {
  title: string;
  eyebrow: string;
  liveLabel: string;
  retryLabel: string;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <View style={[styles.screen, styles.center]}>
      <AnimatedBackground />
      <Animated.View entering={FadeInDown.duration(480).easing(EASE_OUT)} style={styles.loadingBox}>
        <ShieldOrb size={92} />
        <View style={styles.loadingCopy}>
          <View style={styles.eyebrowRow}>
            <PulseDot color={error ? colors.danger : colors.success} size={7} />
            <Text style={type.eyebrow}>{eyebrow}</Text>
          </View>
          <Text style={[type.h2, styles.loadingTitle]}>{title}</Text>
          <Text style={[type.bodySm, styles.loadingHint]}>{error ? retryLabel : liveLabel}</Text>
        </View>
        {error ? <ActionButton variant="primary" label={retryLabel} onPress={onRetry} /> : <ActivityIndicator color={colors.accentBright} />}
      </Animated.View>
    </View>
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

function metricTint(tone: MetricTone): string {
  if (tone === 'success') return colors.success;
  if (tone === 'warning') return colors.danger;
  if (tone === 'neutral') return colors.text2;
  return colors.accentText;
}

/** Плотная волна для command center: только fade + подъём, без декоративного вращения. */
function enterOperatorCard(index: number) {
  return FadeInDown.delay(Math.min(index, 8) * 44).duration(420).easing(EASE_OUT);
}

function formatMetric(value: number): string {
  try {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  } catch {
    return value.toLocaleString();
  }
}

function relativeTime(value: string, labels: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string }): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return labels.justNow;
  if (minutes < 60) return labels.minutesAgo.replace('{count}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return labels.hoursAgo.replace('{count}', String(hours));
  return labels.daysAgo.replace('{count}', String(Math.floor(hours / 24)));
}

function formatShortDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '—';
  return new Date(timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function statusLabel(status: string, labels: { open: string; pending: string; resolved: string }): string {
  if (status === 'OPEN') return labels.open;
  if (status === 'PENDING') return labels.pending;
  return labels.resolved;
}

function groupLabel(group: string, labels: { groupStore: string; groupContent: string; groupPlatform: string }): string {
  if (group === 'store') return labels.groupStore;
  if (group === 'content') return labels.groupContent;
  return labels.groupPlatform;
}

function featureIcon(group: string): IconName {
  if (group === 'store') return 'bag-handle-outline';
  if (group === 'content') return 'sparkles-outline';
  return 'layers-outline';
}

function integrationIcon(key: string): IconName {
  if (key === 'payments') return 'card-outline';
  if (key === 'email') return 'mail-outline';
  if (key === 'storage') return 'cloud-outline';
  if (key === 'sms') return 'chatbubble-outline';
  return 'git-network-outline';
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
  loadingBox: { alignItems: 'center', gap: space.lg, paddingHorizontal: space.xxxl },
  loadingCopy: { alignItems: 'center', gap: space.xs },
  loadingTitle: { textAlign: 'center' },
  loadingHint: { textAlign: 'center' },
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerLive: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(63,185,132,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(63,185,132,0.28)' },
  headerLiveText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: colors.success },
  segmentWrap: { paddingBottom: space.md },
  body: { paddingHorizontal: space.xl, gap: space.md },
  hero: {
    position: 'relative',
    padding: space.xl,
    borderRadius: radius.xl,
    overflow: 'hidden',
    gap: space.lg,
  },
  heroGlowTop: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -110, top: -125, backgroundColor: 'rgba(201,59,82,0.28)' },
  heroGlowBottom: { position: 'absolute', width: 220, height: 220, borderRadius: 110, left: -130, bottom: -150, backgroundColor: 'rgba(226,182,110,0.12)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  heroCopy: { flex: 1, gap: space.sm, paddingRight: space.xs },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  heroLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(11,8,9,0.42)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  heroBadgeText: { color: 'rgba(255,255,255,0.86)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  heroTitle: { flexShrink: 1, fontFamily: type.h2.fontFamily, fontSize: 25, lineHeight: 31, color: colors.white, letterSpacing: -0.2 },
  godTag: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.metal },
  godTagText: { color: colors.bg, fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 1.2 },
  heroSubtitle: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.68)' },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(11,8,9,0.30)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  heroChipText: { maxWidth: 180, color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700' },
  heroStats: { flexDirection: 'row', alignItems: 'stretch', paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.16)' },
  heroMetric: { flex: 1, minWidth: 0, gap: 2 },
  heroMetricLabel: { color: 'rgba(255,255,255,0.52)', fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroMetricValue: { fontSize: 22, lineHeight: 27, fontWeight: '900' },
  heroMetricDetail: { color: 'rgba(255,255,255,0.52)', fontSize: 10, lineHeight: 14 },
  heroDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: space.md, backgroundColor: 'rgba(255,255,255,0.16)' },
  sectionIntro: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  sectionIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(201,59,82,0.30)' },
  sectionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: colors.text, letterSpacing: -0.1 },
  sectionHint: { fontSize: 12, lineHeight: 16, color: colors.text3 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  metricWrap: { width: '47.7%' },
  metricCard: { minHeight: 146, padding: space.md, gap: 3, justifyContent: 'space-between' },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -0.6 },
  metricLabel: { color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  metricSub: { color: colors.text3, fontSize: 11, lineHeight: 15 },
  healthCard: { padding: space.md, gap: space.md },
  healthHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  healthIcon: { backgroundColor: 'rgba(63,185,132,0.12)' },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  healthItem: { width: '47.7%', flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.035)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  healthItemLabel: { color: colors.text, fontSize: 12, lineHeight: 15, fontWeight: '700' },
  healthItemProvider: { color: colors.text3, fontSize: 10, lineHeight: 14 },
  healthFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: space.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  healthFooterText: { color: colors.success, fontSize: 11, fontWeight: '700' },
  previewCard: { padding: space.md, gap: space.md },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  previewIcon: { backgroundColor: colors.accentSoft },
  previewList: { gap: space.xs },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.035)' },
  previewStatusDot: { width: 7, height: 7, borderRadius: 4 },
  previewTopic: { color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  previewMeta: { color: colors.text3, fontSize: 11, lineHeight: 15 },
  previewEmpty: { paddingVertical: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  statWrap: { width: '47.7%' },
  stat: { padding: space.lg, gap: space.xs, minHeight: 98, justifyContent: 'space-between' },
  statLabel: { color: colors.metal },
  card: { padding: space.lg, paddingLeft: space.xl + space.xs, gap: space.sm },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2 },
  metaDot: { color: colors.text3 },
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
  featureIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  integrationStatus: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
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
