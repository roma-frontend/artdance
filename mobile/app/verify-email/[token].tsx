import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useSharedValue } from 'react-native-reanimated';

import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors } from '@/theme';

/**
 * Экран из письма: /verify-email/[token] на сайте. Подтверждение адреса сейчас выключено (письма не уходят,
 * вход без подтверждения), поэтому экран повторяет статичную страницу сайта: текст и переход ко входу.
 */
export default function VerifyEmailScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale).auth.verifyEmail;
  const router = useRouter();
  const shake = useSharedValue(0);

  return (
    <AuthLayout
      mode="sign-in"
      title={c.title}
      signInLabel={t.signInAction}
      signUpLabel={t.signUpAction}
      switchHref="/sign-in"
      switchLabel={t.backToSignIn}
      shake={shake}
    >
      <Animated.Text entering={FadeInDown.duration(250)} style={styles.body}>
        {c.body}
      </Animated.Text>
      <View style={styles.action}>
        <Button label={catalogFor(locale).auth.signIn.submit} onPress={() => router.replace('/sign-in')} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  action: { marginTop: 4 },
});
