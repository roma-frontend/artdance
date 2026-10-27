import { Ionicons } from '@expo/vector-icons';
import { GlassBackdrop } from '@/components/ui/glass-backdrop';
import Constants from 'expo-constants';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useScrollToTop } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Alert, Image, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileSheet, type ProfileField } from '@/components/account/profile-sheet';
import { BrandLogo } from '@/components/brand-logo';
import { Collapsible } from '@/components/ui/collapsible';
import { CollapsingHeader } from '@/components/ui/collapsing-header';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Segmented } from '@/components/ui/segmented';
import { catalogFor } from '@/i18n/catalog';
import { chooseLocale } from '@/lib/app-locale';
import { loadAccountProfile, onProfileChange } from '@/lib/account-profile';
import { getCurrentUser, getKnownUser, signOut, type User } from '@/lib/auth';
import { loadDancerProfile } from '@/lib/dancer-profile';
import { SupportApiError, clearCachedSupportAccess, getSupportAccess, loadCachedSupportAccess, saveCachedSupportAccess } from '@/lib/support';
import { useEntitlements } from '@/lib/entitlements';
import { isOnboardingSnoozed } from '@/lib/onboarding-progress';
import { initials } from '@/lib/format';
import { openLandingWebPath } from '@/lib/web-links';
import { deviceLocale, messagesFor, type Locale } from '@/lib/i18n';
import { animateNextLayout, enterCard3D, openTiming } from '@/lib/motion';
import { useScrollChrome } from '@/lib/use-scroll-chrome';
import { accentGlow, colors, fonts, gradients, radius, space, type } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
/** `feature` — ключ тумблера из `/api/entitlements`: раздел скрыт, когда support его выключил. */
type Row = { icon: IconName; label: string; path: string; tint: string; feature?: string; highlight?: boolean; sub?: string };
type SectionDef = { key: string; title: string; rows: Row[]; open: boolean };

const liquidGlass = isLiquidGlassAvailable();

/** Роли, для которых анкета танцора обязательна при первом входе (как на вебе в `/account`). */
const DANCER_ROLES: ReadonlySet<string> = new Set(['CUSTOMER', 'ATHLETE']);

/** Разделы, которые открываются экраном приложения; остальные ведут на сайт. */
const NATIVE_PATHS: ReadonlySet<string> = new Set([
  '/account/bookings',
  '/account/orders',
  '/account/favorites',
  '/account/subscription',
  '/account/wallet',
  '/account/referrals',
  '/account/data',
  '/account/notifications',
  '/account/dancer-profile',
  '/cart',
  '/courses',
  '/faq',
  '/help',
  '/about',
  '/gift-cards',
  '/legal',
  '/contact',
  '/pricing',
  '/become-instructor',
  '/list-your-studio',
  '/blog',
  '/cities',
  '/accessibility',
  '/studio',
  '/studio/availability',
  '/studio/classes',
  '/support',
  '/venue',
  '/venue/room-assignment',
]);

export default function AccountScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollChrome();
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileSheet, setProfileSheet] = useState(false);
  const [supportAccess, setSupportAccess] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);

  useEffect(
    () =>
      onProfileChange((p) => {
        setAvatarUrl(p.avatarUrl);
        setUser((prev) => (prev && prev.name !== p.name ? { ...prev, name: p.name } : prev));
      }),
    [],
  );

  useEffect(() => {
    getKnownUser().then((known) => {
      if (known) setUser((prev) => prev ?? known);
    });
  }, []);

  useEffect(() => {
    loadCachedSupportAccess().then((cached) => {
      if (cached?.canAccess) setSupportAccess(true);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .catch(() => null)
      .then((u) => {
        if (!alive) return;
        setUser(u);
        if (u) {
          // Сервер решает доступ и обновляет кэш; пункт уже показан из кэша при запуске.
          loadCachedSupportAccess().then((cached) => {
            if (alive && cached && cached.userId !== u.id) setSupportAccess(false);
          });
          getSupportAccess()
            .then(() => {
              if (!alive) return;
              setSupportAccess(true);
              saveCachedSupportAccess(u.id, true);
            })
            .catch((error: unknown) => {
              if (error instanceof SupportApiError && (error.status === 401 || error.status === 403)) {
                if (!alive) return;
                setSupportAccess(false);
                saveCachedSupportAccess(u.id, false);
              }
            });
          loadAccountProfile()
            .then((p) => {
              if (alive) setAvatarUrl(p.avatarUrl);
            })
            .catch(() => undefined);
        }
        // Как на вебе: танцору без пройденной анкеты сначала предлагаем тур.
        if (u && DANCER_ROLES.has(u.role)) {
          Promise.all([loadDancerProfile(), isOnboardingSnoozed()])
            .then(([profile, snoozed]) => {
              if (alive && !snoozed && !profile?.onboardingCompleted) router.replace('/onboarding/dancer');
            })
            .catch(() => undefined);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const signOutShake = useSharedValue(0);
  const signOutShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: signOutShake.value }] }));

  function onSignOut() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    signOutShake.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
    Alert.alert(t.accountSignOutTitle, undefined, [
      { text: t.accountCancel, style: 'cancel' },
      {
        text: t.accountSignOut,
        style: 'destructive',
        onPress: () => {
          signOut()
            .then(() => clearCachedSupportAccess())
            .then(() => router.replace('/sign-in'))
            .catch(() => undefined);
        },
      },
    ]);
  }

  function openRow(row: Row) {
    if (NATIVE_PATHS.has(row.path)) router.push(row.path as '/account/bookings');
    else openLandingWebPath(locale, row.path);
  }

  function openProfileField(field: ProfileField) {
    setProfileSheet(false);
    if (field === 'name' || field === 'password' || field === 'photo') {
      router.push({ pathname: '/account/profile', params: { focus: field } });
    }
  }

  const isDancer = user !== null && DANCER_ROLES.has(user.role);
  const isInstructor = user?.role === 'INSTRUCTOR';
  const isVenueOwner = user?.role === 'VENUE_OWNER';

  const entitlements = useEntitlements();
  const rowVisible = (row: Row) => !row.feature || entitlements?.[row.feature] === true;

  const allQuick: Row[] = [
    { icon: 'calendar', label: c.account.nav.bookings, path: '/account/bookings', tint: '#C93B52' },
    { icon: 'receipt', label: c.account.nav.orders, path: '/account/orders', tint: '#C9A96A', feature: 'shop' },
    { icon: 'wallet', label: c.account.nav.wallet, path: '/account/wallet', tint: '#3FB984', feature: 'wallet' },
    { icon: 'heart', label: c.account.nav.favorites, path: '/account/favorites', tint: '#E0607E' },
  ];
  const allSections: SectionDef[] = [
    {
      key: 'mine',
      title: t.accountSectionMine,
      open: true,
      rows: [
        { icon: 'notifications', label: c.notifications.title, path: '/account/notifications', tint: '#C93B52' },
        ...(isDancer
          ? [{ icon: 'person-circle' as IconName, label: c.onboarding.dancer.edit.title, path: '/account/dancer-profile', tint: '#E0607E' }]
          : []),
        ...(isInstructor
          ? [{ icon: 'briefcase' as IconName, label: c.footer.studioDashboardTitle, path: '/studio', tint: '#C93B52' }]
          : []),
        ...(isVenueOwner
          ? [{ icon: 'storefront' as IconName, label: c.footer.venueDashboardTitle, path: '/venue', tint: '#C9A96A' }]
          : []),
        ...(supportAccess
          ? [{ icon: 'shield-checkmark' as IconName, label: c.admin.support.mobile.entry, path: '/support', tint: colors.accentBright, highlight: true, sub: c.admin.support.operatorMode }]
          : []),
        { icon: 'ribbon', label: c.account.nav.subscription, path: '/account/subscription', tint: '#8E7CC3', feature: 'subscriptions' },
        { icon: 'people', label: c.account.nav.referrals, path: '/account/referrals', tint: '#5AA9E6', feature: 'referrals' },
        { icon: 'school', label: c.courses.title, path: '/courses', tint: '#3FB984', feature: 'courses' },
        { icon: 'cart', label: c.cart.title, path: '/cart', tint: '#C9A96A', feature: 'shop' },
        { icon: 'folder-open', label: c.account.nav.data, path: '/account/data', tint: '#7A8BA6' },
      ],
    },
    {
      key: 'help',
      title: t.accountSectionHelp,
      open: true,
      rows: [
        { icon: 'help-circle', label: c.footer.faq, path: '/faq', tint: '#E0607E' },
        { icon: 'help-buoy', label: c.footer.help, path: '/help', tint: '#3FB984' },
        { icon: 'mail', label: c.footer.contact, path: '/contact', tint: '#3FB984' },
      ],
    },
    {
      key: 'info',
      title: t.accountSectionInfo,
      open: false,
      rows: [
        { icon: 'information-circle', label: c.footer.about, path: '/about', tint: '#C9A96A' },
        { icon: 'document-text', label: c.footer.legalTitle, path: '/legal', tint: '#8E7CC3' },
        { icon: 'newspaper', label: c.blog.title, path: '/blog', tint: '#5AA9E6' },
        { icon: 'pricetags', label: c.nav.pricing, path: '/pricing', tint: '#C9A96A' },
        { icon: 'gift', label: c.footer.giftCards, path: '/gift-cards', tint: '#C9A96A' },
        { icon: 'location', label: c.footer.citiesTitle, path: '/cities', tint: '#3FB984' },
        { icon: 'accessibility', label: c.footer.accessibility, path: '/accessibility', tint: '#5AA9E6' },
      ],
    },
    {
      key: 'partners',
      title: t.accountSectionPartners,
      open: false,
      rows: [
        { icon: 'school', label: c.footer.becomeInstructor, path: '/become-instructor', tint: '#3FB984' },
        { icon: 'business', label: c.footer.listStudio, path: '/list-your-studio', tint: '#C9A96A' },
      ],
    },
    {
      key: 'landing',
      title: t.accountSectionLanding,
      open: false,
      rows: [
        { icon: 'trophy', label: c.nav.competitions, path: '/competitions', tint: '#C9A96A' },
        { icon: 'musical-notes', label: c.nav.socialEvents, path: '/social-events', tint: '#E0607E' },
        { icon: 'medal', label: c.nav.athletes, path: '/athletes', tint: '#8E7CC3' },
        { icon: 'globe', label: c.footer.federations, path: '/federations', tint: '#5AA9E6' },
        { icon: 'people', label: c.footer.partners, path: '/partners', tint: '#3FB984' },
        { icon: 'heart', label: c.footer.sponsors, path: '/sponsors', tint: '#E0607E' },
        { icon: 'megaphone', label: c.footer.advertise, path: '/advertise', tint: '#C9A96A' },
        { icon: 'briefcase', label: c.nav.corporate, path: '/corporate', tint: '#7A8BA6' },
      ],
    },
  ];

  const quick = allQuick.filter(rowVisible);
  const sections = allSections
    .map((section) => ({ ...section, rows: section.rows.filter(rowVisible) }))
    .filter((section) => section.rows.length > 0);

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [-120, 0, 120], [1.15, 1, 0.85], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['rgba(139,26,43,0.45)', 'rgba(11,8,9,0)']} style={styles.glow} pointerEvents="none" />
      <CollapsingHeader scrollY={scrollY} title={c.account.title} threshold={60} />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
      >
        <Animated.Text entering={FadeInDown.duration(500)} style={type.h1}>
          {c.account.title}
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(80).duration(550)}>
          <PressableScale
            tilt
            pressedScale={0.985}
            delayLongPress={350}
            onPress={() => router.push('/account/profile')}
            onLongPress={() => setProfileSheet(true)}
            style={styles.hero}
            accessibilityRole="button"
            accessibilityHint={t.profileHint}
          >
            {liquidGlass ? (
              <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
            ) : (
              <GlassBackdrop intensity={50} />
            )}
            <LinearGradient colors={['rgba(201,59,82,0.28)', 'rgba(11,8,9,0)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Animated.View style={[styles.ringGlow, avatarStyle]}>
              <View style={styles.ring}>
                <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <View style={styles.avatar}>
                  <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <Text style={styles.avatarText}>{initials(user?.name ?? 'A D')}</Text>
                  )}
                </View>
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
            <Text style={styles.editHint}>{t.profileHint}</Text>
          </PressableScale>
        </Animated.View>

        <View style={styles.bento}>
          {quick.map((row, index) => {
            const lead = index === 0;
            return (
              <Animated.View key={row.path} entering={enterCard3D(index, 160)} style={lead ? styles.bentoLead : styles.bentoTrio}>
                <PressableScale
                  tilt
                  pressedScale={0.94}
                  onPress={() => openRow(row)}
                  style={[styles.tile, lead ? styles.tileLead : styles.tileTrio]}
                  accessibilityRole="link"
                >
                  <LinearGradient
                    colors={[`${row.tint}40`, 'rgba(11,8,9,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name={row.icon} size={lead ? 96 : 56} color={`${row.tint}26`} style={styles.watermark} />
                  <LinearGradient colors={[row.tint, `${row.tint}99`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickIcon}>
                    <Ionicons name={row.icon} size={18} color={colors.white} />
                  </LinearGradient>
                  <Text style={[styles.quickLabel, lead && styles.leadLabel]} numberOfLines={2}>
                    {row.label}
                  </Text>
                  {lead ? <Ionicons name="chevron-forward" size={16} color={colors.text3} /> : null}
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        {sections.map((section, index) => (
          <Section key={section.key} section={section} delay={240 + index * 60} onOpen={openRow} />
        ))}

        <Animated.View entering={FadeInDown.delay(560).duration(500)} style={styles.group}>
          <Text style={[type.eyebrow, styles.groupTitle]}>{c.common.labels.language}</Text>
          <Segmented
            options={LOCALE_OPTIONS}
            value={locale}
            onChange={(code) => {
              chooseLocale(code).catch(() => undefined);
            }}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(620).duration(500)} style={signOutShakeStyle}>
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

      <ProfileSheet visible={profileSheet} onClose={() => setProfileSheet(false)} onPick={openProfileField} />
    </View>
  );
}

const LOCALE_OPTIONS: { key: Locale; label: string }[] = [
  { key: 'hy', label: 'Հայերեն' },
  { key: 'ru', label: 'Русский' },
  { key: 'en', label: 'English' },
];

function Section({ section, delay, onOpen }: { section: SectionDef; delay: number; onOpen: (row: Row) => void }) {
  const [open, setOpen] = useState(section.open);
  const turn = useSharedValue(section.open ? 1 : 0);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, openTiming);
  }, [open, turn]);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)} style={styles.group}>
      <PressableScale
        onPress={() => {
          animateNextLayout();
          setOpen((value) => !value);
        }}
        pressedScale={0.985}
        style={styles.sectionHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[type.h3, styles.flex]}>{section.title}</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{section.rows.length}</Text>
        </View>
        <Animated.View style={chevron}>
          <Ionicons name="chevron-down" size={16} color={colors.text3} />
        </Animated.View>
      </PressableScale>
      <Collapsible open={open}>
        <View style={styles.card}>
          {section.rows.map((row, index) => (
            <PressableScale
              key={row.path}
              pressedScale={0.98}
              onPress={() => onOpen(row)}
              style={[styles.row, index > 0 && styles.divider, row.highlight && styles.rowHighlight]}
              accessibilityRole="link"
            >
              <LinearGradient
                colors={row.highlight ? gradients.accent : [row.tint, `${row.tint}99`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.rowIcon, row.highlight && accentGlow]}
              >
                <Ionicons name={row.icon} size={17} color={colors.white} />
              </LinearGradient>
              <View style={styles.flex}>
                <Text style={[type.label, row.highlight && styles.highlightLabel]}>{row.label}</Text>
                {row.sub ? <Text style={type.caption}>{row.sub}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={row.highlight ? colors.accentBright : colors.text3} />
            </PressableScale>
          ))}
        </View>
      </Collapsible>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },
  content: { paddingHorizontal: space.xl, paddingBottom: 140, gap: space.xxl },
  flex: { flex: 1 },
  hero: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  bento: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  bentoLead: { width: '100%' },
  bentoTrio: { flexBasis: 0, flexGrow: 1 },
  tile: {
    padding: space.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  tileLead: { height: 88, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  tileTrio: { height: 116 },
  watermark: { position: 'absolute', right: -10, bottom: -14 },
  quickIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 13, fontWeight: '700', lineHeight: 17, color: colors.text },
  leadLabel: { flex: 1, fontSize: 16, lineHeight: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: 4 },
  countPill: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,241,234,0.08)',
  },
  countText: { fontSize: 11, fontWeight: '700', color: colors.text2 },
  ringGlow: {
    borderRadius: 50,
    marginBottom: space.sm,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  ring: { width: 100, height: 100, borderRadius: 50, padding: 3, overflow: 'hidden' },
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
  editHint: { marginTop: 8, fontSize: 11, color: colors.text3, textAlign: 'center' },
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
  rowIcon: { width: 36, height: 36, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rowHighlight: { backgroundColor: colors.accentSoft },
  highlightLabel: { color: colors.accentBright },
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
