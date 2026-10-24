import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { askAssistant, AssistantError, type AssistantMessage } from '@/lib/assistant';
import { getCurrentUser, type User } from '@/lib/auth';
import { deviceLocale, greeting, messagesFor } from '@/lib/i18n';
import { tabBarHidden } from '@/lib/tab-bar';
import { colors, fill, gradients, radius, space, type } from '@/theme';

/** Высота плавающей панели вкладок и зазор над ней; см. (tabs)/_layout.tsx. */
const TAB_BAR_CLEARANCE = 66 + 10;
const MAX_HISTORY = 20;
const SUGGESTION_KEYS = ['aiSuggestion1', 'aiSuggestion2', 'aiSuggestion3', 'aiSuggestion4'] as const;

type ChatItem = { id: string; role: AssistantMessage['role']; content: string; failed?: boolean };

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = messagesFor(deviceLocale(undefined));
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const seq = useRef(0);

  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .then((found) => {
        if (alive) setUser(found);
      })
      .catch(() => {
        if (alive) setUser(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Клавиатура прячет плавающую панель; уход с экрана возвращает её в исходное состояние.
  useEffect(() => () => {
    tabBarHidden.value = 0;
  }, []);

  const nextId = () => {
    seq.current += 1;
    return `m${seq.current}`;
  };

  const canSend = draft.trim().length > 0 && !busy;

  const send = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || busy) return;
    const next: ChatItem[] = [...messages, { id: nextId(), role: 'user', content }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    // Ошибки в историю не передаём: модель должна видеть только реальный диалог.
    const history: AssistantMessage[] = next
      .filter((item) => !item.failed)
      .slice(-MAX_HISTORY)
      .map((item) => ({ role: item.role, content: item.content }));
    try {
      const reply = await askAssistant(history);
      setMessages((list) => [...list, { id: nextId(), role: 'assistant', content: reply }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      const rateLimited = error instanceof AssistantError && error.code === 'rate_limited';
      setMessages((list) => [
        ...list,
        { id: nextId(), role: 'assistant', content: rateLimited ? t.aiRateLimited : t.aiError, failed: true },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setMessages([]);
    Haptics.selectionAsync().catch(() => undefined);
  };

  if (user === undefined) return <View style={styles.screen} />;

  if (user === null) {
    return (
      <View style={styles.screen}>
        <Aurora />
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <EmptyState
            icon="sparkles-outline"
            title={t.aiSignInTitle}
            body={t.aiSignInBody}
            actionLabel={t.aiSignIn}
            onAction={() => router.push('/sign-in')}
          />
        </View>
      </View>
    );
  }

  const firstName = user.name.split(' ')[0];
  const bottomInset = Math.max(insets.bottom, 12);
  const composerBottom = focused ? bottomInset : bottomInset + TAB_BAR_CLEARANCE;

  return (
    <View style={styles.screen}>
      <Aurora />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t.aiTitle}</Text>
            <View style={styles.statusRow}>
              <PulseDot />
              <Text style={styles.status}>{t.aiOnline}</Text>
            </View>
          </View>
          {messages.length > 0 ? (
            <PressableScale
              onPress={clear}
              accessibilityRole="button"
              accessibilityLabel={t.aiClear}
              hitSlop={8}
              style={styles.iconButton}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.text2} />
            </PressableScale>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.content, messages.length === 0 && styles.contentEmpty]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.hero}>
              <OrbHero />
              <Animated.Text entering={FadeInDown.duration(500)} style={styles.heroTitle}>
                {firstName ? `${greeting(t)}, ${firstName}` : greeting(t)}
              </Animated.Text>
              <Animated.Text entering={FadeInDown.delay(120).duration(500)} style={styles.heroBody}>
                {t.aiIntro}
              </Animated.Text>
              <View style={styles.chips}>
                {SUGGESTION_KEYS.map((key, index) => (
                  <Animated.View key={key} entering={FadeInDown.delay(260 + index * 90).duration(460)}>
                    <PressableScale onPress={() => void send(t[key])} style={styles.chip}>
                      <Text style={styles.chipText}>{t[key]}</Text>
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : (
            messages.map((item) => <Bubble key={item.id} item={item} />)
          )}
          {busy ? <Typing label={t.aiThinking} /> : null}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: composerBottom }]}>
          <View style={styles.inputWrap}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t.aiPlaceholder}
              placeholderTextColor={colors.text3}
              style={styles.input}
              multiline
              maxLength={2000}
              accessibilityLabel={t.aiPlaceholder}
              onFocus={() => {
                setFocused(true);
                tabBarHidden.value = 1;
              }}
              onBlur={() => {
                setFocused(false);
                tabBarHidden.value = 0;
              }}
            />
          </View>
          <PressableScale
            disabled={!canSend}
            onPress={() => void send()}
            accessibilityRole="button"
            accessibilityLabel={t.aiSend}
            style={[styles.sendWrap, !canSend && styles.sendDisabled]}
          >
            <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            </LinearGradient>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Два медленно дрейфующих свечения за фоном: экран живой, но не отвлекает от текста. */
function Aurora() {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift]);

  const orbA = useAnimatedStyle(() => ({
    transform: [{ translateX: -60 + drift.value * 90 }, { translateY: drift.value * 40 }],
  }));
  const orbB = useAnimatedStyle(() => ({
    transform: [{ translateX: 110 - drift.value * 80 }, { translateY: 120 - drift.value * 60 }],
  }));

  return (
    <View style={[fill, styles.aurora]} pointerEvents="none">
      <Animated.View style={[styles.orb, { top: -120, left: -100 }, orbA]}>
        <LinearGradient
          colors={['rgba(201,59,82,0.5)', 'rgba(139,26,43,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={fill}
        />
      </Animated.View>
      <Animated.View style={[styles.orb, { top: 240, right: -150 }, orbB]}>
        <LinearGradient
          colors={['rgba(201,169,106,0.3)', 'rgba(201,169,106,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={fill}
        />
      </Animated.View>
    </View>
  );
}

/** Пульсирующая сфера приветствия: ореол дышит, ядро чуть меняет масштаб. */
function OrbHero() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);

  const glow = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.4,
    transform: [{ scale: 0.92 + pulse.value * 0.2 }],
  }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.05 }] }));

  return (
    <View style={styles.heroOrb}>
      <Animated.View style={[styles.heroGlow, glow]} />
      <Animated.View style={core}>
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCore}>
          <Ionicons name="sparkles" size={34} color={colors.white} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/** Точка «онлайн» с пульсирующим кольцом. */
function PulseDot() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.6 - pulse.value * 0.6,
    transform: [{ scale: 1 + pulse.value * 1.6 }],
  }));

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.pulseRing, ring]} />
      <View style={styles.liveDot} />
    </View>
  );
}

function Bubble({ item }: { item: ChatItem }) {
  const entering = FadeInUp.springify().damping(18).stiffness(220);

  if (item.role === 'user') {
    return (
      <Animated.View entering={entering} style={styles.rowUser}>
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubbleUser}>
          <Text selectable style={styles.textUser}>
            {item.content}
          </Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={entering} style={styles.rowAssistant}>
      <View style={styles.avatar}>
        <Ionicons
          name={item.failed ? 'alert-circle-outline' : 'sparkles'}
          size={14}
          color={item.failed ? colors.danger : colors.metal}
        />
      </View>
      <View style={[styles.bubbleAssistant, item.failed && styles.bubbleFailed]}>
        <Text selectable style={[styles.textAssistant, item.failed && styles.textFailed]}>
          {item.content}
        </Text>
      </View>
    </Animated.View>
  );
}

function Typing({ label }: { label: string }) {
  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.rowAssistant} accessibilityLabel={label}>
      <View style={styles.avatar}>
        <Ionicons name="sparkles" size={14} color={colors.metal} />
      </View>
      <View style={[styles.bubbleAssistant, styles.dots]}>
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
      </View>
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const wave = useSharedValue(0);

  useEffect(() => {
    wave.value = withDelay(delay, withRepeat(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [delay, wave]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + wave.value * 0.7,
    transform: [{ translateY: -wave.value * 4 }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingBottom: TAB_BAR_CLEARANCE },
  aurora: { overflow: 'hidden' },
  orb: { position: 'absolute', width: 340, height: 340, borderRadius: 170, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  headerText: { gap: 4 },
  title: { ...type.h2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { ...type.caption },
  dotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  pulseRing: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
  contentEmpty: { flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: space.md, paddingHorizontal: space.md },
  heroOrb: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  heroGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: colors.accentBright },
  heroCore: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { ...type.h2, textAlign: 'center' },
  heroBody: { ...type.body, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  chipText: { ...type.bodySm, color: colors.text },
  rowUser: { alignItems: 'flex-end' },
  bubbleUser: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.lg,
    borderBottomRightRadius: 6,
  },
  textUser: { color: colors.white, fontSize: 15, lineHeight: 21 },
  rowAssistant: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  bubbleAssistant: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  bubbleFailed: { borderColor: 'rgba(255,107,122,0.4)' },
  textAssistant: { color: colors.text, fontSize: 15, lineHeight: 21 },
  textFailed: { color: colors.danger },
  dots: { flexDirection: 'row', gap: 5, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.metal },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  inputWrap: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    paddingHorizontal: 18,
  },
  input: { color: colors.text, fontSize: 15, paddingVertical: 12 },
  sendWrap: { borderRadius: 24, overflow: 'hidden' },
  sendDisabled: { opacity: 0.4 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
