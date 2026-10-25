import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AuthLayout } from '@/components/auth/auth-layout';
import { FloatingInput } from '@/components/auth/floating-input';
import { SocialSignIn } from '@/components/auth/social-sign-in';
import { Button } from '@/components/ui/button';
import { AuthError, signIn } from '@/lib/auth';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors } from '@/theme';

export default function SignInScreen() {
  const t = messagesFor(deviceLocale(undefined));
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const shake = useSharedValue(0);

  async function submit() {
    if (inFlight.current || !email.trim() || !password) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      hapticSuccess();
      router.replace('/');
    } catch (e) {
      hapticError();
      shake.value = withSequence(
        withTiming(-10, { duration: 60 }),
        withTiming(10, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
      const code = e instanceof AuthError ? e.message : '';
      const status = e instanceof AuthError ? e.status : 0;
      if (code === 'ACCOUNT_LOCKED') setError(t.locked);
      else if (code === 'INVALID_EMAIL_OR_PASSWORD' || status === 401) setError(t.invalidCredentials);
      else setError(t.genericError);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      mode="sign-in"
      title={t.signInTitle}
      signInLabel={t.signInAction}
      signUpLabel={t.signUpAction}
      switchHref="/sign-up"
      switchLabel={t.toSignUp}
      shake={shake}
    >
      <FloatingInput
        label={t.email}
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <FloatingInput
        ref={passwordRef}
        label={t.password}
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Pressable onPress={() => router.push('/forgot-password')} accessibilityRole="link" hitSlop={8}>
        <Text style={styles.link}>{t.forgotLink}</Text>
      </Pressable>
      {error ? (
        <Animated.Text entering={FadeInDown.duration(250)} style={styles.error}>
          {error}
        </Animated.Text>
      ) : null}
      <View style={styles.action}>
        <Button label={t.signInAction} onPress={submit} busy={busy} disabled={!email || !password} />
      </View>
      <SocialSignIn disabled={busy} onError={setError} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  action: { marginTop: 4 },
  link: { alignSelf: 'flex-end', color: colors.accentText, fontSize: 13, fontWeight: '600' },
});
