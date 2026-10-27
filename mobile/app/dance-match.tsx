import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { buildMatchUrl, parseMatchCard, scoreMatch, toMatchCard, type MatchCard } from '@/lib/dance-match';
import { loadDancerProfile, type DancerLevel } from '@/lib/dancer-profile';
import { useEntitlements } from '@/lib/entitlements';
import { deviceLocale } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

type Locale = 'ru' | 'en' | 'hy';

const LEVEL_NAMES: Record<Locale, Record<DancerLevel, string>> = {
  ru: { BEGINNER: 'Начинающий', INTERMEDIATE: 'Средний', ADVANCED: 'Продвинутый' },
  en: { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' },
  hy: { BEGINNER: 'Սկսնակ', INTERMEDIATE: 'Միջին', ADVANCED: 'Առաջադեմ' },
};

const COPY: Record<Locale, {
  back: string;
  title: string;
  intro: string;
  invalid: string;
  noProfile: string;
  noProfileAction: string;
  share: string;
  shareMessage: string;
  shareFailed: string;
  score: string;
  level: string;
  shared: string;
  noShared: string;
  goal: string;
  self: string;
  styles: string;
  verdictHigh: string;
  verdictMid: string;
  verdictLow: string;
}> = {
  ru: {
    back: 'Назад',
    title: 'Подбор партнёра',
    intro: 'Открой ссылку друга, чтобы увидеть совместимость. Видны только уровень, направления и цель, без имени и контактов.',
    invalid: 'Эта ссылка не читается. Попроси друга отправить её ещё раз.',
    noProfile: 'Заполни анкету танцора, чтобы сравнить себя с партнёром.',
    noProfileAction: 'Заполнить анкету',
    share: 'Поделиться моей картой',
    shareMessage: 'Моя карта танцора в ArtDance: ',
    shareFailed: 'Не удалось открыть меню «Поделиться».',
    score: 'Совместимость',
    level: 'Уровень',
    shared: 'Общие направления',
    noShared: 'Общих направлений пока нет',
    goal: 'Цель',
    self: 'Моя карта',
    styles: 'Направления',
    verdictHigh: 'Отличный подбор для пары',
    verdictMid: 'Хорошее совпадение',
    verdictLow: 'Попробуйте занятия вместе, чтобы проверить',
  },
  en: {
    back: 'Back',
    title: 'Dance partner',
    intro: 'Open a friend’s link to see your compatibility. Only level, styles and goal are shown, with no name or contacts.',
    invalid: 'This link can’t be read. Ask your friend to send it again.',
    noProfile: 'Fill in your dancer profile to compare yourself with a partner.',
    noProfileAction: 'Fill in profile',
    share: 'Share my card',
    shareMessage: 'My dancer card on ArtDance: ',
    shareFailed: 'Could not open the share sheet.',
    score: 'Compatibility',
    level: 'Level',
    shared: 'Shared styles',
    noShared: 'No shared styles yet',
    goal: 'Goal',
    self: 'My card',
    styles: 'Styles',
    verdictHigh: 'A great pairing',
    verdictMid: 'A good match',
    verdictLow: 'Try a class together to see',
  },
  hy: {
    back: 'Հետ',
    title: 'Պարային զուգընկեր',
    intro: 'Բացիր ընկերոջ հղումը՝ համատեղելիությունը տեսնելու համար։ Երևում են միայն մակարդակը, ուղղությունները և նպատակը, առանց անվան ու կոնտակտների։',
    invalid: 'Այս հղումը չի կարդացվում։ Խնդրիր ընկերոջդ նորից ուղարկել այն։',
    noProfile: 'Լրացրու պարողի անկետը՝ ինքդ քեզ զուգընկերոջ հետ համեմատելու համար։',
    noProfileAction: 'Լրացնել անկետը',
    share: 'Կիսվել իմ քարտով',
    shareMessage: 'Իմ պարային քարտը ArtDance-ում՝ ',
    shareFailed: 'Չհաջողվեց բացել կիսվելու ընտրացանկը։',
    score: 'Համատեղելիություն',
    level: 'Մակարդակ',
    shared: 'Ընդհանուր ուղղություններ',
    noShared: 'Ընդհանուր ուղղություններ դեռ չկան',
    goal: 'Նպատակ',
    self: 'Իմ քարտը',
    styles: 'Ուղղություններ',
    verdictHigh: 'Հիանալի համադրություն զույգի համար',
    verdictMid: 'Լավ համընկնում',
    verdictLow: 'Փորձիր մի դաս միասին՝ ստուգելու համար',
  },
};

/** Код направления в читаемый вид: HIP_HOP → Hip Hop. */
function styleName(key: string): string {
  return key
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function stylesText(styles: string[]): string {
  return styles.length > 0 ? styles.map(styleName).join(', ') : '—';
}

/** Экран подбора партнёра. Выключен тумблером `dancePartner`: без него экран не открывается. */
export default function DanceMatchScreen() {
  const entitlements = useEntitlements();
  if (entitlements === null) return null;
  if (entitlements.dancePartner !== true) return <Redirect href="/" />;
  return <DanceMatchContent />;
}

function DanceMatchContent() {
  const { p } = useLocalSearchParams<{ p?: string }>();
  const locale = deviceLocale(undefined) as Locale;
  const copy = COPY[locale] ?? COPY.en;
  const levels = LEVEL_NAMES[locale] ?? LEVEL_NAMES.en;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mine, setMine] = useState<MatchCard | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'no-profile'>('loading');
  const partner = useMemo(() => parseMatchCard(p), [p]);

  useEffect(() => {
    let alive = true;
    loadDancerProfile()
      .then((profile) => {
        if (!alive) return;
        if (profile?.onboardingCompleted) {
          setMine(toMatchCard(profile));
          setStatus('ready');
        } else {
          setStatus('no-profile');
        }
      })
      .catch(() => {
        if (alive) setStatus('no-profile');
      });
    return () => {
      alive = false;
    };
  }, []);

  const header = (
    <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
      <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={copy.back}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </PressableScale>
      <Text style={type.h2}>{copy.title}</Text>
    </Animated.View>
  );

  if (status === 'loading') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      </View>
    );
  }

  if (mine === null) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <EmptyState icon="person-outline" title={copy.noProfile} actionLabel={copy.noProfileAction} onAction={() => router.push('/onboarding/dancer')} />
      </View>
    );
  }

  const result = partner ? scoreMatch(mine, partner) : null;
  const verdict = result === null ? null : result.score >= 75 ? copy.verdictHigh : result.score >= 50 ? copy.verdictMid : copy.verdictLow;

  async function share() {
    try {
      await Share.share({ message: `${copy.shareMessage}${buildMatchUrl(mine as MatchCard)}` });
    } catch {
      Alert.alert(copy.shareFailed);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {result && partner ? (
          <Animated.View entering={enterItem(0)} style={styles.card}>
            <Text style={type.eyebrow}>{copy.score}</Text>
            <Text style={styles.score}>{result.score}%</Text>
            <Text style={type.body}>{verdict}</Text>
            <Detail label={copy.level} value={levels[partner.level]} />
            <Detail label={copy.shared} value={result.sharedStyles.length > 0 ? stylesText(result.sharedStyles) : copy.noShared} />
            <Detail label={copy.goal} value={partner.goal ?? '—'} />
          </Animated.View>
        ) : p ? (
          <Text style={type.body}>{copy.invalid}</Text>
        ) : (
          <Text style={type.body}>{copy.intro}</Text>
        )}

        <Animated.View entering={enterItem(1)} style={styles.card}>
          <Text style={type.eyebrow}>{copy.self}</Text>
          <Detail label={copy.level} value={levels[mine.level]} />
          <Detail label={copy.styles} value={stylesText(mine.styles)} />
          <Detail label={copy.goal} value={mine.goal ?? '—'} />
        </Animated.View>

        <Button label={copy.share} variant="ghost" onPress={share} />
      </ScrollView>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={type.eyebrow}>{label}</Text>
      <Text style={type.body} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.lg },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.md },
  detail: { gap: 4 },
  score: { ...type.h2, fontSize: 40, color: colors.accentBright },
});
