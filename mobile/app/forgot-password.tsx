import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AuthLayout } from '@/components/auth/auth-layout';
import { FloatingInput } from '@/components/auth/floating-input';
import { Button } from '@/components/ui/button';
import { AuthError, requestPasswordReset } from '@/lib/auth';
import { webUrl } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const shake = useSharedValue(0);

  async function submit() {
    setBusy(true);
    setError(null);
    setCaptchaFailed(false);
    try {
      await requestPasswordReset(email.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake.value = withSequence(
        withTiming(-10, { duration: 60 }),
        withTiming(10, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
      // Капча проверяется только на сайте: отправляем пользователя туда.
      const captcha = e instanceof AuthError && e.message === 'CAPTCHA_FAILED';
      setCaptchaFailed(captcha);
      setError(captcha ? t.forgotCaptcha : t.genericError);
    } finally {
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
          {captchaFailed ? (
            <View style={styles.action}>
              <Button label={t.forgotOpenWeb} onPress={() => Linking.openURL(webUrl(locale, '/forgot-password')).catch(() => undefined)} variant="ghost" />
            </View>
          ) : null}
          <View style={styles.action}>
            <Button label={t.forgotSubmit} onPress={submit} busy={busy} disabled={!email.trim()} />
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
