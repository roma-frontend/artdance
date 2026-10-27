import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import { DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { TestCardStubHost } from '@/components/payments/test-card-stub';
import { SplashLoader } from '@/components/splash-loader';
import { EmptyState } from '@/components/ui/empty-state';
import { catalogFor } from '@/i18n/catalog';
import { loadLocale, useLocale } from '@/lib/app-locale';
import { getCurrentUser, onSessionChange, type User } from '@/lib/auth';
import '@/lib/reminders';
import { StripeRoot } from '@/lib/stripe-sheet';
import { colors } from '@/theme';

// Короткий минимум, чтобы заставка не мигала; остальное время задаёт реальная готовность.
const SPLASH_MIN_MS = 700;

// Фон темы под экранами: без него при свайпе назад виден светлый фон.
const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accentBright,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.line,
  },
};

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [splashTimeUp, setSplashTimeUp] = useState(false);
  const [localeReady, setLocaleReady] = useState(false);
  const locale = useLocale();
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
  });
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const id = setTimeout(() => setSplashTimeUp(true), SPLASH_MIN_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    loadLocale()
      .catch(() => undefined)
      .finally(() => setLocaleReady(true));
  }, []);
  const group = segments[0];
  // Актуальные сегменты нужны после асинхронного запроса сессии, без лишней перерисовки.
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  // Сессия перепроверяется при смене группы экранов, а редирект делается только
  // после её ответа. Иначе после входа или выхода редирект срабатывал по старому
  // состоянию и возвращал пользователя назад.
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      getCurrentUser()
        .then((u) => {
          if (!alive) return;
          setOffline(false);
          setUser(u);
          const segment = segmentsRef.current[0] ?? '';
          const inAuth = ['sign-in', 'sign-up', 'forgot-password'].includes(segment);
          // Ссылки из письма открываются и без сессии: сброс пароля и подтверждение почты.
          // Справочные страницы публичные: условия нужно прочитать до регистрации.
          const openLink = ['reset-password', 'verify-email', 'newsletter', 'accessibility', 'legal', 'faq', 'help', 'about', 'blog'].includes(segment);
          if (!u && !inAuth && !openLink) router.replace('/sign-in');
          if (u && inAuth) router.replace('/');
        })
        .catch(() => {
          // Сеть или сервер недоступны и прежнего пользователя нет: не выход, а экран повтора.
          if (alive) setOffline(true);
        });
    };
    refresh();
    const unsubscribe = onSessionChange(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [group, router, retryKey]);

  const retry = useCallback(() => {
    setOffline(false);
    setRetryKey((k) => k + 1);
  }, []);

  if (offline && user === undefined && localeReady) {
    const c = catalogFor(locale);
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <EmptyState icon="cloud-offline-outline" title={c.common.states.offline} actionLabel={c.common.actions.retry} onAction={retry} />
      </View>
    );
  }

  if (!localeReady || user === undefined || (!fontsLoaded && !fontError) || !splashTimeUp) {
    return <SplashLoader />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
    <StripeRoot>
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack
        key={locale}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 260,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="catalog/[section]/index" options={{ animation: 'default' }} />
        <Stack.Screen name="catalog/[section]/[slug]" options={{ animation: 'default' }} />
        <Stack.Screen name="account/bookings" options={{ animation: 'default' }} />
        <Stack.Screen name="account/orders" options={{ animation: 'default' }} />
        <Stack.Screen name="account/orders/[orderNumber]" options={{ animation: 'default' }} />
        <Stack.Screen name="account/favorites" options={{ animation: 'default' }} />
        <Stack.Screen name="account/subscription" options={{ animation: 'default' }} />
        <Stack.Screen name="account/wallet" options={{ animation: 'default' }} />
        <Stack.Screen name="account/referrals" options={{ animation: 'default' }} />
        <Stack.Screen name="account/data" options={{ animation: 'default' }} />
        <Stack.Screen name="account/notifications" options={{ animation: 'default' }} />
        <Stack.Screen name="account/dancer-profile" options={{ animation: 'default' }} />
        <Stack.Screen name="onboarding/dancer" options={{ animation: 'default' }} />
        <Stack.Screen name="dance-match" options={{ animation: 'default' }} />
        <Stack.Screen name="booking/[id]/pass" options={{ animation: 'default' }} />
        <Stack.Screen name="booking/[id]/reschedule" options={{ animation: 'default' }} />
        <Stack.Screen name="booking/[id]/review" options={{ animation: 'default' }} />
        <Stack.Screen name="events/[slug]/register" options={{ animation: 'default' }} />
        <Stack.Screen name="cart" options={{ animation: 'default' }} />
        <Stack.Screen name="search" options={{ animation: 'default' }} />
        <Stack.Screen name="checkout" options={{ animation: 'default' }} />
        <Stack.Screen name="faq" options={{ animation: 'default' }} />
        <Stack.Screen name="help" options={{ animation: 'default' }} />
        <Stack.Screen name="about" options={{ animation: 'default' }} />
        <Stack.Screen name="gift-cards" options={{ animation: 'default' }} />
        <Stack.Screen name="gift-cards/redeem" options={{ animation: 'default' }} />
        <Stack.Screen name="legal" options={{ animation: 'default' }} />
        <Stack.Screen name="accessibility" options={{ animation: 'default' }} />
        <Stack.Screen name="studio/index" options={{ animation: 'default' }} />
        <Stack.Screen name="studio/[slug]/book" options={{ animation: 'default' }} />
        <Stack.Screen name="studio/classes" options={{ animation: 'default' }} />
        <Stack.Screen name="studio/availability" options={{ animation: 'default' }} />
        <Stack.Screen name="support/index" options={{ animation: 'default' }} />
        <Stack.Screen name="venue/index" options={{ animation: 'default' }} />
        <Stack.Screen name="venue/room-assignment" options={{ animation: 'default' }} />
        <Stack.Screen name="contact" options={{ animation: 'default' }} />
      <Stack.Screen name="pricing" options={{ animation: 'default' }} />
      <Stack.Screen name="become-instructor" options={{ animation: 'default' }} />
      <Stack.Screen name="become-instructor/apply" options={{ animation: 'default' }} />
      <Stack.Screen name="reset-password" options={{ animation: 'default' }} />
      <Stack.Screen name="verify-email/[token]" options={{ animation: 'default' }} />
      <Stack.Screen name="newsletter/confirm/[token]" options={{ animation: 'default' }} />
      <Stack.Screen name="newsletter/unsubscribe/[token]" options={{ animation: 'default' }} />
      <Stack.Screen name="list-your-studio" options={{ animation: 'default' }} />
      <Stack.Screen name="blog" options={{ animation: 'default' }} />
      <Stack.Screen name="schedule" options={{ animation: 'default' }} />
      <Stack.Screen name="styles/index" options={{ animation: 'default' }} />
      <Stack.Screen name="styles/[slug]" options={{ animation: 'default' }} />
      <Stack.Screen name="cities/index" options={{ animation: 'default' }} />
      <Stack.Screen name="cities/[city]/index" options={{ animation: 'default' }} />
      <Stack.Screen name="cities/[city]/[district]" options={{ animation: 'default' }} />
        <Stack.Screen name="book/[instructor]" options={{ animation: 'slide_from_bottom', gestureEnabled: true }} />
      </Stack>
      <TestCardStubHost />
    </ThemeProvider>
    </StripeRoot>
    </GestureHandlerRootView>
  );
}
