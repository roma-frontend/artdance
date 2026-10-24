import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingInput } from '@/components/auth/floating-input';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { AuthError, changePassword, getCurrentUser, updateName, type User } from '@/lib/auth';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

const MIN_PASSWORD_LENGTH = 10;

type Notice = { ok: boolean; text: string };

/** Настройки профиля: имя и пароль. Адрес и роль меняются через поддержку. */
export default function ProfileScreen() {
  const t = messagesFor(deviceLocale(undefined));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const scroll = useRef<ScrollViewInstance>(null);
  const passwordY = useRef(0);

  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameNotice, setNameNotice] = useState<Notice | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .catch(() => null)
      .then((found) => {
        if (!alive) return;
        setUser(found);
        setName(found?.name ?? '');
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const trimmedName = name.trim();
  const nameReady = trimmedName.length > 0 && trimmedName !== user?.name;
  const passwordReady = current.length > 0 && next.length >= MIN_PASSWORD_LENGTH;

  async function saveName() {
    setNameBusy(true);
    setNameNotice(null);
    try {
      await updateName(trimmedName);
      setUser((prev) => (prev ? { ...prev, name: trimmedName } : prev));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNameNotice({ ok: true, text: t.profileSaved });
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setNameNotice({ ok: false, text: t.genericError });
    } finally {
      setNameBusy(false);
    }
  }

  async function savePassword() {
    setPasswordBusy(true);
    setPasswordNotice(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPasswordNotice({ ok: true, text: t.profilePasswordChanged });
    } catch (error: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const code = error instanceof AuthError ? error.message : '';
      setPasswordNotice({ ok: false, text: code === 'INVALID_PASSWORD' ? t.profileWrongPassword : t.genericError });
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.accountCancel} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{t.profileTitle}</Text>
      </Animated.View>

      {!loaded ? null : user === null ? (
        <Text style={[type.bodySm, styles.pad]}>{t.accountEmpty}</Text>
      ) : (
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]}
        >
          <Animated.View entering={FadeInDown.delay(60).duration(420).easing(EASE_OUT)} style={styles.card}>
            <Text style={type.h3}>{t.name}</Text>
            <FloatingInput
              label={t.name}
              icon="person-outline"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setNameNotice(null);
              }}
              autoComplete="name"
              textContentType="name"
            />
            <Button label={t.profileSave} onPress={saveName} busy={nameBusy} disabled={!nameReady || nameBusy} />
            {nameNotice ? (
              <Animated.Text entering={FadeInDown.duration(250)} style={nameNotice.ok ? styles.ok : styles.error}>
                {nameNotice.text}
              </Animated.Text>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(140).duration(420).easing(EASE_OUT)}
            style={styles.card}
            onLayout={(event) => {
              passwordY.current = event.nativeEvent.layout.y;
              if (focus === 'password') scroll.current?.scrollTo({ y: passwordY.current - space.xl, animated: true });
            }}
          >
            <Text style={type.h3}>{t.profilePasswordTitle}</Text>
            <FloatingInput
              label={t.profileCurrentPassword}
              icon="lock-closed-outline"
              value={current}
              onChangeText={(value) => {
                setCurrent(value);
                setPasswordNotice(null);
              }}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
            />
            <FloatingInput
              label={t.profileNewPassword}
              icon="key-outline"
              value={next}
              onChangeText={(value) => {
                setNext(value);
                setPasswordNotice(null);
              }}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Text style={styles.rules}>{t.profilePasswordRules}</Text>
            <Button label={t.profileSave} onPress={savePassword} busy={passwordBusy} disabled={!passwordReady || passwordBusy} />
            {passwordNotice ? (
              <Animated.Text entering={FadeInDown.duration(250)} style={passwordNotice.ok ? styles.ok : styles.error}>
                {passwordNotice.text}
              </Animated.Text>
            ) : null}
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, gap: space.md },
  pad: { paddingHorizontal: space.xl },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(245,241,234,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  rules: { fontSize: 12, color: colors.text3 },
  ok: { fontSize: 13, color: colors.metal, fontWeight: '600' },
  error: { fontSize: 13, color: colors.accentBright },
});
