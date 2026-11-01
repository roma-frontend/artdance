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

import { PaymentSheetHost } from '@/components/payments/payment-sheet';
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

/**
 * Экран-«лист»: выезжает снизу и закрывается свайпом вниз, как билет или форма в онлайн-кинотеатрах.
 * Свайп начинается только в верхней зоне, чтобы не спорить с прокруткой формы.
 */
const SHEET = {
  animation: 'slide_from_bottom',
  gestureEnabled: true,
  gestureDirection: 'vertical',
  fullScreenGestureEnabled: true,
  animationMatchesGesture: true,
  gestureResponseDistance: { top: 160 },
} as const;

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
          // Переход как в iOS на обеих платформах: экран выезжает справа, предыдущий уходит с параллаксом.
          animation: 'ios_from_right',
          animationDuration: 350,
          // Назад — свайпом от левой части экрана, а не только от самого края.
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animationMatchesGesture: true,
          gestureResponseDistance: { start: 72 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="sign-in" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="sign-up" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="catalog/[section]/index" />
        <Stack.Screen name="catalog/[section]/[slug]" />
        <Stack.Screen name="account/bookings" />
        <Stack.Screen name="account/orders" />
        <Stack.Screen name="account/orders/[orderNumber]" />
        <Stack.Screen name="account/favorites" />
        <Stack.Screen name="account/subscription" />
        <Stack.Screen name="account/wallet" />
        <Stack.Screen name="account/referrals" />
        <Stack.Screen name="account/data" />
        <Stack.Screen name="account/notifications" />
        <Stack.Screen name="account/dancer-profile" />
        <Stack.Screen name="account/saved-searches" />
        <Stack.Screen name="account/athlete" />
        <Stack.Screen name="account/company" />
        <Stack.Screen name="account/security" />
        <Stack.Screen name="onboarding/dancer" />
        <Stack.Screen name="dance-match" />
        <Stack.Screen name="booking/[id]/pass" options={SHEET} />
        <Stack.Screen name="booking/[id]/reschedule" options={SHEET} />
        <Stack.Screen name="booking/[id]/review" options={SHEET} />
        <Stack.Screen name="events/[slug]/register" options={SHEET} />
        <Stack.Screen name="cart" />
        <Stack.Screen name="search" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="faq" />
        <Stack.Screen name="help" />
        <Stack.Screen name="about" />
        <Stack.Screen name="gift-cards" />
        <Stack.Screen name="gift-cards/redeem" options={SHEET} />
        <Stack.Screen name="legal" />
        <Stack.Screen name="accessibility" />
        <Stack.Screen name="studio/index" />
        <Stack.Screen name="studio/[slug]/book" options={SHEET} />
        <Stack.Screen name="studio/classes" />
        <Stack.Screen name="studio/availability" />
        <Stack.Screen name="studio/requests" />
        <Stack.Screen name="studio/reviews" />
        <Stack.Screen name="studio/analytics" />
        <Stack.Screen name="studio/boost" />
        <Stack.Screen name="support/index" />
        <Stack.Screen name="venue/index" />
        <Stack.Screen name="venue/room-assignment" />
        <Stack.Screen name="contact" />
      <Stack.Screen name="pricing" />
      <Stack.Screen name="become-instructor" />
      <Stack.Screen name="become-instructor/apply" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-email/[token]" />
      <Stack.Screen name="newsletter/confirm/[token]" />
      <Stack.Screen name="newsletter/unsubscribe/[token]" />
      <Stack.Screen name="list-your-studio" />
      <Stack.Screen name="blog" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="styles/index" />
      <Stack.Screen name="styles/[slug]" />
      <Stack.Screen name="cities/index" />
      <Stack.Screen name="cities/[city]/index" />
      <Stack.Screen name="cities/[city]/[district]" />
        <Stack.Screen name="book/[instructor]" options={SHEET} />
      </Stack>
      <PaymentSheetHost />
    </ThemeProvider>
    </StripeRoot>
    </GestureHandlerRootView>
  );
}
