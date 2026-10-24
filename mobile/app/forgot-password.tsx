import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AuthLayout } from '@/components/auth/auth-layout';
import { FloatingInput } from '@/components/auth/floating-input';
import { Button } from '@/components/ui/button';
import { requestPasswordReset } from '@/lib/auth';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const t = messagesFor(deviceLocale(undefined));
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shake = useSharedValue(0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake.value = withSequence(
        withTiming(-10, { duration: 60 }),
        withTiming(10, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
      setError(t.genericError);
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
