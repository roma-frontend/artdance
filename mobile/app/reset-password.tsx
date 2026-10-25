import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AuthLayout } from '@/components/auth/auth-layout';
import { FloatingInput } from '@/components/auth/floating-input';
import { Button } from '@/components/ui/button';
import { catalogFor } from '@/i18n/catalog';
import { AuthError, resetPassword } from '@/lib/auth';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors } from '@/theme';

/** Экран из письма: /reset-password?token=… на сайте, artdance://reset-password?token=… в приложении. */
export default function ResetPasswordScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token) ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const confirmRef = useRef<TextInputInstance>(null);
  const shake = useSharedValue(0);

  function fail(message: string) {
    hapticError();
    shake.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
    setError(message);
  }

  async function submit() {
    if (inFlight.current || !password || !confirmPassword) return;
    setError(null);
    if (password !== confirmPassword) {
      fail(c.validation.passwordsDoNotMatch);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      await resetPassword({ token, password, confirmPassword }, c);
      hapticSuccess();
      setDone(true);
    } catch (e: unknown) {
      // Сообщение сервера уже переведено; пустое означает, что перевода нет.
      fail(e instanceof AuthError && e.message ? e.message : t.genericError);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      mode="sign-in"
      title={c.auth.resetPassword.title}
      signInLabel={t.signInAction}
      signUpLabel={t.signUpAction}
      switchHref="/sign-in"
      switchLabel={t.backToSignIn}
      shake={shake}
    >
      {!token ? (
        <>
          <Animated.Text entering={FadeInDown.duration(250)} style={styles.error}>
            {c.auth.resetPassword.invalidToken}
          </Animated.Text>
          <View style={styles.action}>
            <Button label={c.auth.forgotPassword.title} onPress={() => router.replace('/forgot-password')} variant="ghost" />
          </View>
        </>
      ) : done ? (
        <>
          <Animated.Text entering={FadeInDown.duration(250)} style={styles.sent}>
            {c.auth.resetPassword.success}
          </Animated.Text>
          <View style={styles.action}>
            <Button label={c.auth.signIn.submit} onPress={() => router.replace('/sign-in')} />
          </View>
        </>
      ) : (
        <>
          <FloatingInput
            label={c.auth.resetPassword.newPassword}
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <FloatingInput
            ref={confirmRef}
            label={c.auth.resetPassword.confirmPassword}
            icon="lock-closed-outline"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {error ? (
            <Animated.Text entering={FadeInDown.duration(250)} style={styles.error}>
              {error}
            </Animated.Text>
          ) : null}
          <View style={styles.action}>
            <Button label={c.auth.resetPassword.submit} onPress={submit} busy={busy} disabled={!password || !confirmPassword} />
          </View>
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  sent: { color: colors.text, fontSize: 15, lineHeight: 22 },
  action: { marginTop: 4 },
});
