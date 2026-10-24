import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { CollapsingHeader } from '@/components/ui/collapsing-header';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { getCurrentUser, signOut, type User } from '@/lib/auth';
import { initials, webUrl } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { useScrollChrome } from '@/lib/use-scroll-chrome';
import { colors, fonts, gradients, radius, space, type } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Row = { icon: IconName; label: string; path: string; tint: string };

/** Разделы, которые открываются экраном приложения; остальные ведут на сайт. */
const NATIVE_PATHS: ReadonlySet<string> = new Set([
  '/account/bookings',
  '/account/orders',
  '/account/favorites',
  '/account/subscription',
  '/account/wallet',
  '/account/referrals',
  '/cart',
  '/faq',
  '/help',
  '/about',
  '/gift-cards',
  '/legal',
  '/contact',
  '/pricing',
]);

export default function AccountScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollChrome();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .catch(() => null)
      .then((u) => {
        if (alive) setUser(u);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function onSignOut() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await signOut();
    router.replace('/sign-in');
  }

  const mine: Row[] = [
    { icon: 'receipt', label: c.account.nav.orders, path: '/account/orders', tint: '#C9A96A' },
    { icon: 'ribbon', label: c.account.nav.subscription, path: '/account/subscription', tint: '#8E7CC3' },
    { icon: 'wallet', label: c.account.nav.wallet, path: '/account/wallet', tint: '#3FB984' },
    { icon: 'people', label: c.account.nav.referrals, path: '/account/referrals', tint: '#5AA9E6' },
    { icon: 'heart', label: c.account.nav.favorites, path: '/account/favorites', tint: '#E0607E' },
    { icon: 'cart', label: c.cart.title, path: '/cart', tint: '#C9A96A' },
    { icon: 'folder-open', label: c.account.nav.data, path: '/account/data', tint: '#7A8BA6' },
  ];
  const bookingsRow: Row = { icon: 'calendar', label: c.account.nav.bookings, path: '/account/bookings', tint: '#C93B52' };
  const info: Row[] = [
    { icon: 'help-circle', label: c.footer.faq, path: '/faq', tint: '#E0607E' },
    { icon: 'help-buoy', label: c.footer.help, path: '/help', tint: '#3FB984' },
    { icon: 'information-circle', label: c.footer.about, path: '/about', tint: '#C9A96A' },
    { icon: 'gift', label: c.footer.giftCards, path: '/gift-cards', tint: '#C9A96A' },
    { icon: 'document-text', label: c.footer.legalTitle, path: '/legal', tint: '#8E7CC3' },
    { icon: 'mail', label: c.footer.contact, path: '/contact', tint: '#3FB984' },
    { icon: 'pricetags', label: c.nav.pricing, path: '/pricing', tint: '#C9A96A' },
  ];

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [-120, 0, 120], [1.15, 1, 0.85], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['rgba(139,26,43,0.45)', 'rgba(11,8,9,0)']} style={styles.glow} pointerEvents="none" />
      <CollapsingHeader scrollY={scrollY} title={c.account.title} threshold={60} />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
      >
        <Animated.Text entering={FadeInDown.duration(500)} style={type.h1}>
          {c.account.title}
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(80).duration(550)} style={styles.profile}>
          <Animated.View style={[styles.ring, avatarStyle]}>
            <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.avatar}>
              <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.avatarText}>{initials(user?.name ?? 'A D')}</Text>
            </View>
          </Animated.View>
          <Text style={styles.name} numberOfLines={1}>
            {user?.name ?? t.accountEmpty}
          </Text>
          {user ? <Text style={type.bodySm}>{user.email}</Text> : null}
          <View style={styles.member}>
            <Ionicons name="sparkles" size={12} color={colors.metal} />
            <Text style={styles.memberText}>{t.accountMember}</Text>
          </View>
        </Animated.View>

        <Group title={t.accountSectionMine} rows={[bookingsRow, ...mine]} locale={locale} delay={160} router={router} />
        <Group title={t.accountSectionInfo} rows={info} locale={locale} delay={240} router={router} />

        <Animated.View entering={FadeInDown.delay(320).duration(500)}>
          <PressableScale onPress={onSignOut} style={styles.signOut} pressedScale={0.97}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.signOutText}>{t.accountSignOut}</Text>
          </PressableScale>
        </Animated.View>

        <View style={styles.footer}>
          <BrandLogo width={120} />
          <Text style={styles.version}>
            {Constants.expoConfig?.version ?? ''} · {c.brand.madeIn}
          </Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function Group({
  title,
  rows,
  locale,
  delay,
  router,
}: {
  title: string;
  rows: Row[];
  locale: ReturnType<typeof deviceLocale>;
  delay: number;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)} style={styles.group}>
      <Text style={[type.eyebrow, styles.groupTitle]}>{title}</Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <PressableScale
            key={row.path}
            pressedScale={0.98}
            onPress={() => (NATIVE_PATHS.has(row.path) ? router.push(row.path as '/account/bookings') : Linking.openURL(webUrl(locale, row.path)).catch(() => undefined))}
            style={[styles.row, index > 0 && styles.divider]}
            accessibilityRole="link"
          >
            <View style={[styles.rowIcon, { backgroundColor: `${row.tint}26` }]}>
              <Ionicons name={row.icon} size={17} color={row.tint} />
            </View>
            <Text style={[type.label, styles.flex]}>{row.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text3} />
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },
  content: { paddingHorizontal: space.xl, paddingBottom: 140, gap: space.xxl },
  flex: { flex: 1 },
  profile: { alignItems: 'center', gap: 6, paddingVertical: space.lg },
  ring: { width: 100, height: 100, borderRadius: 50, padding: 3, overflow: 'hidden', marginBottom: space.sm },
  avatar: {
    flex: 1,
    borderRadius: 47,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },
  avatarText: { fontFamily: fonts.display, fontSize: 32, color: colors.white },
  name: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.text },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(201,169,106,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,106,0.35)',
  },
  memberText: { fontSize: 12, fontWeight: '700', color: colors.metal },
  group: { gap: space.md },
  groupTitle: { paddingHorizontal: 4 },
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: space.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,107,122,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,107,122,0.3)',
  },
  signOutText: { fontSize: 16, fontWeight: '700', color: colors.danger },
  footer: { alignItems: 'center', gap: space.sm },
  version: { ...type.caption, textAlign: 'center' },
});
