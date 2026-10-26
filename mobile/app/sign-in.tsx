import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AuthLayout } from '@/components/auth/auth-layout';
import { FloatingInput } from '@/components/auth/floating-input';
import { OtpInput } from '@/components/auth/otp-input';
import { SocialSignIn } from '@/components/auth/social-sign-in';
import { Button } from '@/components/ui/button';
import { AuthError, cancelTwoFactor, sendTwoFactorCode, signIn, verifyTwoFactorCode } from '@/lib/auth';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { deviceLocale, messagesFor, type Messages } from '@/lib/i18n';
import { colors } from '@/theme';

/** Длина кода и пауза до повторной отправки, как в вебе. */
const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

type Step = 'credentials' | 'code';

/** Текст ошибки по коду сервера. Неверную пару отличаем по коду или статусу 401. */
function errorText(e: unknown, t: Messages): string {
  const code = e instanceof AuthError ? e.message : '';
  const status = e instanceof AuthError ? e.status : 0;
  if (code === 'ACCOUNT_LOCKED' || code === 'ACCOUNT_TEMPORARILY_LOCKED') return t.locked;
  if (code === 'INVALID_CODE') return t.otpInvalid;
  if (code === 'OTP_HAS_EXPIRED' || code === 'INVALID_TWO_FACTOR_COOKIE') return t.otpExpired;
  if (code === 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE') return t.otpTooMany;
  if (code === 'INVALID_EMAIL_OR_PASSWORD' || status === 401) return t.invalidCredentials;
  return t.genericError;
}

export default function SignInScreen() {
  const t = messagesFor(deviceLocale(undefined));
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inFlight = useRef(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /** Одна операция за раз: повторные нажатия, пока запрос в пути, игнорируются. Ошибка встряхивает карточку. */
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      hapticError();
      shake.value = withSequence(
        withTiming(-10, { duration: 60 }),
        withTiming(10, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
      setError(errorText(e, t));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function sendCode() {
    await sendTwoFactorCode();
    setCooldown(RESEND_SECONDS);
  }

  function submitCredentials() {
    if (!email.trim() || !password) return;
    void run(async () => {
      const result = await signIn(email.trim(), password);
      if (result.status === 'signed-in') {
        hapticSuccess();
        router.replace('/');
        return;
      }
      setCode('');
      setStep('code');
      await sendCode();
    });
  }

  function submitCode(value: string) {
    if (value.length !== CODE_LENGTH) return;
    void run(async () => {
      try {
        await verifyTwoFactorCode(value);
      } catch (e) {
        setCode('');
        throw e;
      }
      hapticSuccess();
      router.replace('/');
    });
  }

  function resendCode() {
    if (cooldown > 0) return;
    void run(async () => {
      setCode('');
      await sendCode();
    });
  }

  function backToCredentials() {
    cancelTwoFactor();
    setCode('');
    setError(null);
    setStep('credentials');
  }

  const errorNode = error ? (
    <Animated.Text entering={FadeInDown.duration(250)} style={styles.error}>
      {error}
    </Animated.Text>
  ) : null;

  return (
    <AuthLayout
      mode="sign-in"
      title={step === 'code' ? t.otpTitle : t.signInTitle}
      signInLabel={t.signInAction}
      signUpLabel={t.signUpAction}
      switchHref="/sign-up"
      switchLabel={t.toSignUp}
      shake={shake}
    >
      {step === 'code' ? (
        <Animated.View entering={FadeInDown.duration(350)} style={styles.stack}>
          <Text style={styles.subtitle}>{t.otpSubtitle.replace('{length}', String(CODE_LENGTH))}</Text>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={submitCode}
            length={CODE_LENGTH}
            disabled={busy}
            autoFocus
            accessibilityLabel={t.otpTitle}
          />
          {errorNode}
          <Button label={t.otpVerify} onPress={() => submitCode(code)} busy={busy} disabled={code.length !== CODE_LENGTH} />
          <View style={styles.row}>
            <Pressable onPress={backToCredentials} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.link}>{t.otpBack}</Text>
            </Pressable>
            <Pressable onPress={resendCode} disabled={cooldown > 0 || busy} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.link, cooldown > 0 && styles.muted]}>
                {cooldown > 0 ? t.otpResendIn.replace('{seconds}', String(cooldown)) : t.otpResend}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
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
            onSubmitEditing={submitCredentials}
          />
          <Pressable onPress={() => router.push('/forgot-password')} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.link}>{t.forgotLink}</Text>
          </Pressable>
          {errorNode}
          <View style={styles.action}>
            <Button label={t.signInAction} onPress={submitCredentials} busy={busy} disabled={!email || !password} />
          </View>
          <SocialSignIn disabled={busy} onError={setError} />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  action: { marginTop: 4 },
  link: { alignSelf: 'flex-end', color: colors.accentText, fontSize: 13, fontWeight: '600' },
  muted: { color: colors.text3 },
  stack: { gap: 16 },
  subtitle: { color: colors.text2, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
