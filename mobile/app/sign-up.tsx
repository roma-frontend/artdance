import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AuthLayout } from '@/components/auth/auth-layout';
import { FloatingInput } from '@/components/auth/floating-input';
import { SocialSignIn } from '@/components/auth/social-sign-in';
import { Button } from '@/components/ui/button';
import { catalogFor } from '@/i18n/catalog';
import { AuthError, signUp } from '@/lib/auth';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Строка согласия записана с тегами ссылок; разбиваем её на текст и две ссылки. */
function consentParts(template: string): { text: string; link?: 'terms' | 'privacy' }[] {
  return template
    .split(/(<termsLink>.*?<\/termsLink>|<privacyLink>.*?<\/privacyLink>)/)
    .filter(Boolean)
    .map((part) => {
      const terms = /^<termsLink>(.*)<\/termsLink>$/.exec(part);
      if (terms) return { text: terms[1], link: 'terms' as const };
      const privacy = /^<privacyLink>(.*)<\/privacyLink>$/.exec(part);
      if (privacy) return { text: privacy[1], link: 'privacy' as const };
      return { text: part };
    });
}

export default function SignUpScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
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
    if (inFlight.current) return;
    if (!name.trim() || !email.trim() || !password) return fail(c.validation.required);
    if (!EMAIL.test(email.trim())) return fail(c.validation.email);
    if (!accepted) return fail(c.validation.termsRequired);
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await signUp(name.trim(), email.trim(), password);
      hapticSuccess();
      router.replace('/');
    } catch (error: unknown) {
      const code = error instanceof AuthError ? error.message : '';
      if (code.startsWith('USER_ALREADY_EXISTS')) fail(c.auth.signUp.emailTaken);
      else if (code.startsWith('PASSWORD_TOO_SHORT') || code.startsWith('PASSWORD_TOO_WEAK')) fail(t.profilePasswordRules);
      else fail(t.genericError);
    } finally {
      inFlight.current = false;
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
      <FloatingInput
        label={t.name}
        icon="person-outline"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <FloatingInput
        ref={emailRef}
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
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Text style={styles.hint}>{t.profilePasswordRules}</Text>
      <Pressable
        onPress={() => setAccepted((v) => !v)}
        disabled={busy}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted, disabled: busy }}
        style={styles.consent}
      >
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={22} color={accepted ? colors.accentBright : colors.text3} />
        <Text style={styles.consentText}>
          {consentParts(c.auth.signUp.termsConsent).map((part, index) =>
            part.link ? (
              <Text
                key={index}
                style={styles.consentLink}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/legal', params: { slug: part.link } })}
              >
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </Text>
      </Pressable>
      {error ? (
        <Animated.Text entering={FadeInDown.duration(250)} style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Animated.Text>
      ) : null}
      <View style={styles.action}>
        <Button label={t.signUpAction} onPress={submit} busy={busy} disabled={!name || !email || !password || !accepted} />
      </View>
      {/* Социальная регистрация тоже создаёт аккаунт: сначала согласие с условиями. */}
      <SocialSignIn disabled={busy || !accepted} onError={setError} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  action: { marginTop: 4 },
  hint: { color: colors.text3, fontSize: 12, lineHeight: 16 },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44, paddingVertical: 4 },
  consentText: { flex: 1, color: colors.text2, fontSize: 13, lineHeight: 19 },
  consentLink: { color: colors.text, fontWeight: '700', textDecorationLine: 'underline' },
});
