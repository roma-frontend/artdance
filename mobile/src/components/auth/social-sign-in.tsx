import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import {
  loadSocialProviders,
  nativeAppleAvailable,
  signInWithAppleNative,
  signInWithBrowser,
  type SocialProvider,
  type SocialProviders,
} from '@/lib/social-auth';
import { colors, radius, space } from '@/theme';

type Props = { disabled?: boolean; onError: (message: string) => void };

/**
 * Кнопки социального входа. Показываются только настроенные на сервере провайдеры;
 * на iOS Apple — системной кнопкой, как требуют правила App Store.
 */
export function SocialSignIn({ disabled, onError }: Props) {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const [providers, setProviders] = useState<SocialProviders | null>(null);
  const [appleNative, setAppleNative] = useState(false);
  const [pending, setPending] = useState<SocialProvider | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadSocialProviders(), nativeAppleAvailable()]).then(([found, native]) => {
      if (!alive) return;
      setProviders(found);
      setAppleNative(native);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!providers || (!providers.google && !providers.apple)) return null;

  async function run(provider: SocialProvider, action: () => Promise<boolean>) {
    if (pending || disabled) return;
    setPending(provider);
    try {
      // Успех сам переключает сессию: корневой layout уведёт со страницы входа.
      if (await action()) hapticSuccess();
    } catch {
      hapticError();
      onError(t.genericError);
    } finally {
      setPending(null);
    }
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>{c.auth.signIn.orDivider}</Text>
        <View style={styles.line} />
      </View>

      {providers.apple && appleNative ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={radius.md}
          style={styles.appleButton}
          onPress={() => void run('apple', signInWithAppleNative)}
        />
      ) : providers.apple ? (
        <SocialButton
          icon="logo-apple"
          label={t.appleCta}
          busy={pending === 'apple'}
          disabled={disabled || pending !== null}
          onPress={() => void run('apple', () => signInWithBrowser('apple'))}
        />
      ) : null}

      {providers.google ? (
        <SocialButton
          icon="logo-google"
          label={c.auth.signIn.googleCta}
          busy={pending === 'google'}
          disabled={disabled || pending !== null}
          onPress={() => void run('google', () => signInWithBrowser('google'))}
        />
      ) : null}
    </Animated.View>
  );
}

function SocialButton(props: {
  icon: 'logo-google' | 'logo-apple';
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled, busy: props.busy }}
      style={[styles.button, props.disabled && !props.busy && styles.dim]}
    >
      {props.busy ? <ActivityIndicator color={colors.text} /> : <Ionicons name={props.icon} size={18} color={colors.text} />}
      <Text style={styles.buttonText}>{props.label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
  or: { fontSize: 12, color: colors.text3, textTransform: 'uppercase', letterSpacing: 1 },
  appleButton: { height: 50 },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: 'rgba(245,241,234,0.06)',
  },
  dim: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontWeight: '700', color: colors.text },
});
