import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type StyleProp,
  type TextStyle,
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
import { askAssistant, AssistantError, type AssistantBookAction, type AssistantMessage } from '@/lib/assistant';
import { splitAssistantText } from '@/lib/assistant-links';
import { getCurrentUser, type User } from '@/lib/auth';
import { ASSISTANT_LOGO_URI as ASSISTANT_LOGO } from '@/lib/catalog';
import { bookClassSession, BookingsError } from '@/lib/bookings';
import { dateLabel } from '@/lib/format';
import { deviceLocale, greeting, messagesFor, type Locale } from '@/lib/i18n';
import { scheduleBookingReminder } from '@/lib/reminders';
import { SpeechModule } from '@/lib/speech';
import { tabBarHidden } from '@/lib/tab-bar';
import { colors, fill, gradients, radius, space, type } from '@/theme';

/** Высота плавающей панели вкладок и зазор над ней; см. (tabs)/_layout.tsx. */
const TAB_BAR_CLEARANCE = 66 + 10;
const MAX_HISTORY = 20;
const SUGGESTION_KEYS = ['aiSuggestion1', 'aiSuggestion2', 'aiSuggestion3', 'aiSuggestion4'] as const;

type ChatItem = {
  id: string;
  role: AssistantMessage['role'];
  content: string;
  failed?: boolean;
  actions?: AssistantBookAction[];
};

/** Состояние записи по занятию; ключ — ID занятия. */
type BookState = { status: 'busy' } | { status: 'done'; reference?: string } | { status: 'error'; message: string };

/** Языки распознавания речи по языку приложения. */
const SPEECH_LANG: Record<Locale, string> = { hy: 'hy-AM', ru: 'ru-RU', en: 'en-US' };

/** Останавливает распознавание; исключение означает, что модуль речи недоступен, и останавливать нечего. */
function stopVoice() {
  try {
    SpeechModule?.stop();
  } catch {
    // Распознавание уже остановлено.
  }
}

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [bookStates, setBookStates] = useState<Record<string, BookState>>({});
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<'denied' | 'unavailable' | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  /** Текст черновика на момент нажатия микрофона: распознанное дописывается к нему. */
  const draftBeforeVoice = useRef('');
  const scrollRef = useRef<ScrollViewInstance>(null);
  const seq = useRef(0);
  /** Очистка и уход с экрана меняют поколение: опоздавший ответ старого диалога отбрасывается. */
  const generation = useRef(0);
  /** Читатель у нижнего края: только тогда новый текст прокручивает ленту. */
  const nearBottom = useRef(true);

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
  // На Android клавиатура закрывается без blur, поэтому ориентир — события клавиатуры, а не фокус.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => {
      setKeyboardOpen(true);
      tabBarHidden.value = 1;
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
      tabBarHidden.value = 0;
    });
    return () => {
      show.remove();
      hide.remove();
      tabBarHidden.value = 0;
      generation.current += 1;
      stopVoice();
    };
  }, []);

  useEffect(() => {
    if (!SpeechModule) return;
    const subscriptions = [
      SpeechModule.addListener('start', () => setListening(true)),
      SpeechModule.addListener('end', () => setListening(false)),
      SpeechModule.addListener('result', (event) => {
        const transcript = event.results[0]?.transcript?.trim() ?? '';
        setDraft([draftBeforeVoice.current.trim(), transcript].filter(Boolean).join(' '));
      }),
      SpeechModule.addListener('error', (event) => {
        setListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceNote('denied');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setVoiceNote('unavailable');
        }
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  useEffect(() => {
    setVoiceSupported(SpeechModule?.isRecognitionAvailable() ?? false);
  }, []);

  const nextId = () => {
    seq.current += 1;
    return `m${seq.current}`;
  };

  // Отправка во время записи блокируется: распознанный текст не должен попасть в уже отправленный черновик.
  const canSend = draft.trim().length > 0 && !busy && !listening;

  /** Микрофон включается только по нажатию; текст попадает в черновик и не отправляется сам. */
  const toggleMic = async () => {
    if (!SpeechModule) return;
    if (listening) {
      stopVoice();
      return;
    }
    setVoiceNote(null);
    try {
      const permission = await SpeechModule.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceNote('denied');
        return;
      }
      draftBeforeVoice.current = draft;
      SpeechModule.start({ lang: SPEECH_LANG[locale], interimResults: true });
    } catch {
      setVoiceNote('unavailable');
    }
  };

  /** Запись идёт только по явному нажатию кнопки в карточке. Оплата здесь не запускается. */
  const bookAction = async (action: AssistantBookAction) => {
    const current = bookStates[action.sessionId];
    if (current?.status === 'busy' || current?.status === 'done') return;
    setBookStates((states) => ({ ...states, [action.sessionId]: { status: 'busy' } }));
    try {
      const booking = await bookClassSession({
        sessionId: action.sessionId,
        startsAt: action.startsAt,
        endsAt: action.endsAt,
      });
      setBookStates((states) => ({ ...states, [action.sessionId]: { status: 'done', reference: booking.reference } }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      scheduleBookingReminder({
        bookingId: booking.id,
        title: action.title,
        startsAt: action.startsAt,
        body: t.bookingReminderBody,
      }).catch(() => undefined);
    } catch (error) {
      const message =
        error instanceof BookingsError && error.status === 409
          ? t.bookSlotTaken
          : (error instanceof BookingsError && error.serverMessage) || t.bookFailed;
      setBookStates((states) => ({ ...states, [action.sessionId]: { status: 'error', message } }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || busy) return;
    const next: ChatItem[] = [...messages, { id: nextId(), role: 'user', content }];
    const gen = generation.current;
    nearBottom.current = true;
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
      if (gen !== generation.current) return;
      setMessages((list) => [
        ...list,
        { id: nextId(), role: 'assistant', content: reply.reply, actions: reply.actions },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      if (gen !== generation.current) return;
      const rateLimited = error instanceof AssistantError && error.code === 'rate_limited';
      setMessages((list) => [
        ...list,
        { id: nextId(), role: 'assistant', content: rateLimited ? t.aiRateLimited : t.aiError, failed: true },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  };

  const clear = () => {
    generation.current += 1;
    setMessages([]);
    setBusy(false);
    Haptics.selectionAsync().catch(() => undefined);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
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
  const initial = (user.name.trim().charAt(0) || '?').toUpperCase();
  const bottomInset = Math.max(insets.bottom, 12);
  const composerBottom = keyboardOpen ? bottomInset : bottomInset + TAB_BAR_CLEARANCE;

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
          onScroll={onScroll}
          scrollEventThrottle={64}
          onContentSizeChange={() => {
            if (nearBottom.current) scrollRef.current?.scrollToEnd({ animated: true });
          }}
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
            messages.map((item) => (
              <Bubble key={item.id} item={item} initial={initial} bookStates={bookStates} onBook={bookAction} />
            ))
          )}
          {busy ? <Typing label={t.aiThinking} /> : null}
        </ScrollView>

        {voiceNote ? (
          <Text accessibilityLiveRegion="polite" style={styles.voiceNote}>
            {voiceNote === 'denied' ? t.aiMicDenied : t.aiMicUnavailable}
          </Text>
        ) : null}
        <View style={[styles.composer, { paddingBottom: composerBottom }]}>
          {voiceSupported ? (
            <PressableScale
              onPress={() => void toggleMic()}
              accessibilityRole="button"
              accessibilityLabel={listening ? t.aiMicStop : t.aiMic}
              style={[styles.micButton, listening && styles.micButtonOn]}
            >
              <Ionicons
                name={listening ? 'stop' : 'mic-outline'}
                size={20}
                color={listening ? colors.white : colors.text2}
              />
            </PressableScale>
          ) : null}
          <View style={styles.inputWrap}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={listening ? t.aiListening : t.aiPlaceholder}
              placeholderTextColor={colors.text3}
              style={styles.input}
              multiline
              maxLength={2000}
              accessibilityLabel={t.aiPlaceholder}
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
        <Image source={{ uri: ASSISTANT_LOGO }} style={styles.heroCore} contentFit="cover" transition={300} accessibilityLabel="ArtDance AI" />
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

/** Ссылки в ответе ведут на экраны приложения; остальной текст остаётся выделяемым. */
function LinkedText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const router = useRouter();
  const segments = splitAssistantText(text, deviceLocale(undefined));
  return (
    <Text selectable style={style}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') return <Text key={index}>{segment.value}</Text>;
        if (!segment.href) return <Text key={index}>{segment.label}</Text>;
        const href = segment.href;
        return (
          <Text
            key={index}
            accessibilityRole="link"
            style={styles.link}
            onPress={() => router.push(href)}
          >
            {segment.label}
          </Text>
        );
      })}
    </Text>
  );
}

function Bubble({
  item,
  initial,
  bookStates,
  onBook,
}: {
  item: ChatItem;
  initial: string;
  bookStates: Record<string, BookState>;
  onBook: (action: AssistantBookAction) => void;
}) {
  const entering = FadeInUp.springify().damping(18).stiffness(220);

  if (item.role === 'user') {
    return (
      <Animated.View entering={entering} style={styles.rowUser}>
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubbleUser}>
          <Text selectable style={styles.textUser}>
            {item.content}
          </Text>
        </LinearGradient>
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userAvatar}>
          <Text style={styles.userInitial}>{initial}</Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={entering} style={styles.rowAssistant}>
      <View style={styles.avatar}>
        {item.failed ? (
          <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
        ) : (
          <Image source={{ uri: ASSISTANT_LOGO }} style={styles.avatarLogo} contentFit="cover" />
        )}
      </View>
      <View style={styles.assistantColumn}>
        {item.content ? (
          <View style={[styles.bubbleAssistant, item.failed && styles.bubbleFailed]}>
            <LinkedText text={item.content} style={[styles.textAssistant, item.failed && styles.textFailed]} />
          </View>
        ) : null}
        {item.actions?.map((action) => (
          <BookCard key={action.sessionId} action={action} state={bookStates[action.sessionId]} onBook={onBook} />
        ))}
      </View>
    </Animated.View>
  );
}

/** Карточка предложенного занятия: запись только по кнопке, без автоматического бронирования. */
function BookCard({
  action,
  state,
  onBook,
}: {
  action: AssistantBookAction;
  state: BookState | undefined;
  onBook: (action: AssistantBookAction) => void;
}) {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const busy = state?.status === 'busy';

  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.bookCard}>
      <View style={styles.bookHead}>
        <Ionicons name="calendar-outline" size={16} color={colors.accentText} />
        <Text style={styles.bookTitle} numberOfLines={2}>
          {action.title}
        </Text>
      </View>
      <Text style={styles.bookMeta}>
        {dateLabel(action.startsAt, locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </Text>
      <Text style={styles.bookMeta}>{`${t.aiSpotsLeft} ${action.spotsLeft}`}</Text>
      {state?.status === 'done' ? (
        <>
          <View style={styles.bookDone}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.bookDoneText}>
              {state.reference ? `${t.aiBookDone} · ${state.reference}` : t.aiBookDone}
            </Text>
          </View>
          <Text style={styles.bookMeta}>{t.aiBookDoneHint}</Text>
        </>
      ) : (
        <>
          {state?.status === 'error' ? <Text style={styles.bookError}>{state.message}</Text> : null}
          <PressableScale
            disabled={busy}
            onPress={() => onBook(action)}
            accessibilityRole="button"
            accessibilityLabel={t.aiBookAction}
            style={[styles.bookButton, busy && styles.sendDisabled]}
          >
            <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bookButtonFill}>
              <Text style={styles.bookButtonText}>{busy ? t.aiBookBusy : t.aiBookAction}</Text>
            </LinearGradient>
          </PressableScale>
        </>
      )}
    </Animated.View>
  );
}

function Typing({ label }: { label: string }) {
  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.rowAssistant} accessibilityLabel={label}>
      <View style={styles.avatar}>
        <Image source={{ uri: ASSISTANT_LOGO }} style={styles.avatarLogo} contentFit="cover" />
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
  heroCore: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden' },
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
  rowUser: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: space.sm },
  userAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  userInitial: { color: colors.white, fontSize: 12, fontWeight: '700' },
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
  avatarLogo: { width: 26, height: 26, borderRadius: 13 },
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
  link: { color: colors.accentText, textDecorationLine: 'underline' },
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
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  micButtonOn: { backgroundColor: colors.accentBright, borderColor: colors.accentBright },
  voiceNote: { ...type.caption, color: colors.danger, paddingHorizontal: space.lg, paddingTop: space.sm },
  assistantColumn: { flex: 1, gap: space.sm, alignItems: 'flex-start' },
  bookCard: {
    maxWidth: '86%',
    gap: 6,
    padding: space.md,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  bookHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bookTitle: { ...type.bodySm, color: colors.text, flexShrink: 1, fontWeight: '600' },
  bookMeta: { ...type.caption },
  bookDone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bookDoneText: { ...type.bodySm, color: colors.text, fontWeight: '600' },
  bookError: { ...type.caption, color: colors.danger },
  bookButton: { alignSelf: 'flex-start', borderRadius: radius.pill, overflow: 'hidden', marginTop: 2 },
  bookButtonFill: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.pill },
  bookButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
