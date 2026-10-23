import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';

import { SplashLoader } from '@/components/splash-loader';
import { getCurrentUser, onSessionChange, type User } from '@/lib/auth';
import { colors } from '@/theme';

const SPLASH_MIN_MS = 2000;

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [splashTimeUp, setSplashTimeUp] = useState(false);
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
          const inAuth = segmentsRef.current[0] === 'sign-in' || segmentsRef.current[0] === 'sign-up';
          if (!u && !inAuth) router.replace('/sign-in');
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

  if (user === undefined || (!fontsLoaded && !fontError) || !splashTimeUp) {
    return <SplashLoader />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
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
        <Stack.Screen name="book/[instructor]" options={{ animation: 'slide_from_bottom', gestureEnabled: true }} />
      </Stack>
    </>
  );
}
