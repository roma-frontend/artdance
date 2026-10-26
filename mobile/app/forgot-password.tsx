import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AuthLayout } from '@/components/auth/auth-layout';
import { FloatingInput } from '@/components/auth/floating-input';
import { Button } from '@/components/ui/button';
import { captchaRequired, TurnstileChallenge } from '@/components/ui/turnstile-challenge';
import { AuthError, requestPasswordReset } from '@/lib/auth';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const inFlight = useRef(false);
  const shake = useSharedValue(0);
  const captchaPending = captchaRequired && captchaToken === null;

  async function submit() {
    if (inFlight.current || !email.trim() || captchaPending) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim(), captchaToken);
      hapticSuccess();
      setSent(true);
    } catch (e) {
      hapticError();
      shake.value = withSequence(
        withTiming(-10, { duration: 60 }),
        withTiming(10, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
      // Сервер возвращает нейтральную ошибку, не раскрывая состояние аккаунта.
      const captcha = e instanceof AuthError && e.message === 'CAPTCHA_FAILED';
      setError(captcha ? t.forgotCaptcha : t.genericError);
      // Токен одноразовый: после любой ошибки просим пройти проверку заново.
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      mode="sign-in"
      title={t.forgotTitle}
      signInLabel={t.signInAction}
      signUpLabel={t.signUpAction}
      switchHref="/sign-in"
      switchLabel={t.backToSignIn}
      shake={shake}
    >
      {sent ? (
        <Animated.Text entering={FadeInDown.duration(250)} style={styles.sent}>
          {t.forgotSent}
        </Animated.Text>
      ) : (
        <>
          <FloatingInput
            label={t.email}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {error ? (
            <Animated.Text entering={FadeInDown.duration(250)} style={styles.error}>
              {error}
            </Animated.Text>
          ) : null}
          <TurnstileChallenge onToken={setCaptchaToken} resetKey={captchaKey} />
          <View style={styles.action}>
            <Button label={t.forgotSubmit} onPress={submit} busy={busy} disabled={!email.trim() || captchaPending} />
          </View>
        </>
      )}
      {sent ? (
        <View style={styles.action}>
          <Button label={t.backToSignIn} onPress={() => router.replace('/sign-in')} variant="ghost" />
        </View>
      ) : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  sent: { color: colors.text, fontSize: 15, lineHeight: 22 },
  action: { marginTop: 4 },
});
