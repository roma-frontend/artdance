import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import { DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';

import { SplashLoader } from '@/components/splash-loader';
import { loadLocale, useLocale } from '@/lib/app-locale';
import { getCurrentUser, onSessionChange, type User } from '@/lib/auth';
import '@/lib/reminders';
import { colors } from '@/theme';

const SPLASH_MIN_MS = 2000;

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
        .catch(() => null)
        .then((u) => {
          if (!alive) return;
          setUser(u);
          const segment = segmentsRef.current[0] ?? '';
          const inAuth = ['sign-in', 'sign-up', 'forgot-password'].includes(segment);
          // Ссылки из письма открываются и без сессии: сброс пароля и подтверждение почты.
          // Страница доступности публичная, поэтому тоже открыта без входа.
          const openLink = ['reset-password', 'verify-email', 'accessibility'].includes(segment);
          if (!u && !inAuth && !openLink) router.replace('/sign-in');
          if (u && inAuth) router.replace('/');
        });
    };
    refresh();
    const unsubscribe = onSessionChange(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [group, router]);

  if (!localeReady || user === undefined || (!fontsLoaded && !fontError) || !splashTimeUp) {
    return <SplashLoader />;
  }

  return (
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
        <Stack.Screen name="studio/availability" options={{ animation: 'default' }} />
        <Stack.Screen name="venue/index" options={{ animation: 'default' }} />
        <Stack.Screen name="contact" options={{ animation: 'default' }} />
      <Stack.Screen name="pricing" options={{ animation: 'default' }} />
      <Stack.Screen name="become-instructor" options={{ animation: 'default' }} />
      <Stack.Screen name="become-instructor/apply" options={{ animation: 'default' }} />
      <Stack.Screen name="reset-password" options={{ animation: 'default' }} />
      <Stack.Screen name="verify-email/[token]" options={{ animation: 'default' }} />
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
    </ThemeProvider>
  );
}
