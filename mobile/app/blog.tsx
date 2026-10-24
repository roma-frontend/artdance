import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { FadeImage } from '@/components/ui/fade-image';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import type { Locale } from '@/i18n/config';
import { getBlogDetail, getBlogList, type BlogCard, type BlogDetail, type BlogList } from '@/lib/blog';
import { mediaUri } from '@/lib/catalog';
import { dateLabel, plural } from '@/lib/format';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { colors, radius, space, type } from '@/theme';

/**
 * Блог. Без параметра `slug` — список с фильтром по категориям, с параметром — статья.
 * Как и `legal`, это один экран: переход к похожей статье открывает его же с другим слагом.
 */
export default function BlogScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const m = catalogFor(locale).blog;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [list, setList] = useState<BlogList | null>(null);
  const [post, setPost] = useState<BlogDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (slug) {
      setPost(null);
      getBlogDetail(locale, slug)
        .then((next) => {
          if (alive) setPost(next);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    } else {
      getBlogList(locale, { category: category ?? undefined })
        .then((next) => {
          if (!alive) return;
          setList(next);
          // Список категорий берём только из неотфильтрованного ответа, чтобы чипы не пропадали.
          if (!category) setCategories(next.categories);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    }
    return () => {
      alive = false;
    };
  }, [locale, slug, category]);

  const openPost = (next: string) => router.push({ pathname: '/blog', params: { slug: next } });
  const loaded = slug ? post !== null : list !== null;
  const title = slug ? (post?.title ?? '') : m.title;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={m.backToBlog}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={[type.h2, styles.headerTitle]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {failed ? (
        <EmptyState icon="alert-circle-outline" title={t.catalogError} actionLabel={m.backToBlog} onAction={() => router.back()} />
      ) : !loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentBright} />
        </View>
      ) : slug && post ? (
        <ScrollView contentContainerStyle={styles.article} showsVerticalScrollIndicator={false}>
          {post.image ? (
            <View style={styles.cover}>
              <FadeImage uri={mediaUri(post.image.key)} />
            </View>
          ) : null}
          {post.category ? <Text style={type.eyebrow}>{post.category}</Text> : null}
          <Text style={type.h1}>{post.title}</Text>
          <Text style={type.caption}>{metaLine(post, locale, m.readingTime)}</Text>
          {splitBody(post.body).map((paragraph, index) => (
            <Text key={index} style={type.body}>
              {paragraph}
            </Text>
          ))}

          <Text style={[type.h2, styles.sectionTitle]}>{m.relatedTitle}</Text>
          {post.related.length === 0 ? (
            <Text style={type.bodySm}>{m.relatedEmpty}</Text>
          ) : (
            post.related.map((item) => (
              <BlogCardView key={item.slug} item={item} locale={locale} readingLabel={m.readingTime} onPress={() => openPost(item.slug)} />
            ))
          )}
        </ScrollView>
      ) : list ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <Text style={type.bodySm}>{m.subtitle}</Text>
          {categories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label={m.filterAll} active={category === null} onPress={() => setCategory(null)} />
              {categories.map((name) => (
                <Chip key={name} label={name} active={category === name} onPress={() => setCategory(name)} />
              ))}
            </ScrollView>
          ) : null}
          <Text style={type.eyebrow}>{m.latestTitle}</Text>
          {list.items.length === 0 ? (
            <EmptyState icon="newspaper-outline" title={m.empty} body={m.emptyHint} />
          ) : (
            list.items.map((item) => (
              <BlogCardView key={item.slug} item={item} locale={locale} readingLabel={m.readingTime} onPress={() => openPost(item.slug)} />
            ))
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

function BlogCardView({
  item,
  locale,
  readingLabel,
  onPress,
}: {
  item: BlogCard;
  locale: Locale;
  readingLabel: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={item.title}>
      <View style={styles.card}>
        {item.image ? (
          <View style={styles.cover}>
            <FadeImage uri={mediaUri(item.image.key)} />
          </View>
        ) : null}
        {item.category ? <Text style={type.eyebrow}>{item.category}</Text> : null}
        <Text style={type.h3}>{item.title}</Text>
        <Text style={type.bodySm} numberOfLines={3}>
          {item.excerpt}
        </Text>
        <Text style={type.caption}>{metaLine(item, locale, readingLabel)}</Text>
      </View>
    </PressableScale>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View style={[styles.chip, active && styles.chipActive]}>
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

function metaLine(item: BlogCard, locale: Locale, readingLabel: string): string {
  const date = dateLabel(item.publishedAt, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const reading = plural(readingLabel, item.readingMinutes, locale);
  return [item.authorName, date, reading].filter(Boolean).join(' · ');
}

/** Текст хранится простым полотном; абзацы разделены пустой строкой, как и на `/blog/[slug]`. */
function splitBody(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  headerTitle: { flex: 1 },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.lg },
  article: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  chips: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  chipTextActive: { color: colors.white },
  card: { gap: space.sm },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  sectionTitle: { marginTop: space.xl },
});
