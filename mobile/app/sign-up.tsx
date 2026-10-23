import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AuthLayout } from '@/components/auth/auth-layout';
import { FloatingInput } from '@/components/auth/floating-input';
import { Button } from '@/components/ui/button';
import { signUp } from '@/lib/auth';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors } from '@/theme';

export default function SignUpScreen() {
  const t = messagesFor(deviceLocale(undefined));
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shake = useSharedValue(0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signUp(name.trim(), email.trim(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
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
      mode="sign-up"
      title={t.signUpTitle}
      signInLabel={t.signInAction}
      signUpLabel={t.signUpAction}
      switchHref="/sign-in"
      switchLabel={t.toSignIn}
      shake={shake}
    >
      <FloatingInput label={t.name} icon="person-outline" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <FloatingInput
        label={t.email}
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <FloatingInput
        label={t.password}
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
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
        <Button label={t.signUpAction} onPress={submit} busy={busy} disabled={!name || !email || !password} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  action: { marginTop: 4 },
});
