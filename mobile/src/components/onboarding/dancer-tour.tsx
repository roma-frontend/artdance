import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import { type DancerLevel, type DancerProfile, saveDancerProfile } from '@/lib/dancer-profile';
import { levelLabel, plural, styleLabel } from '@/lib/format';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { clearOnboardingProgress, loadOnboardingStep, saveOnboardingStep, snoozeOnboarding } from '@/lib/onboarding-progress';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

/** Три шага тура: уровень → направления → цель. Порядок совпадает с веб-версией. */
const STEPS = ['level', 'styles', 'goal'] as const;
type Step = (typeof STEPS)[number];

const LEVELS: readonly DancerLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const LEVEL_KEY: Record<DancerLevel, 'beginner' | 'intermediate' | 'advanced'> = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
};

/** Направления, которые предлагаются в туре. KIZOMBA в веб-туре не показывается — сохраняем тот же список. */
const PICKABLE_STYLES: readonly string[] = [
  'HIP_HOP', 'SALSA', 'BACHATA', 'LATIN', 'BALLET', 'CONTEMPORARY', 'JAZZ', 'HEELS', 'KPOP',
  'BREAKING', 'AFRO', 'FLAMENCO', 'ARMENIAN_FOLK', 'BALLROOM', 'TANGO', 'WEDDING_DANCE', 'KIDS', 'STRETCHING',
];

type Props = {
  /** `onboarding` — после финального шага выходим из тура; `edit` — правка анкеты. */
  mode: 'onboarding' | 'edit';
  /** Ответы, уже сохранённые на сервере, или `null`, если анкеты ещё нет. */
  initial: DancerProfile | null;
  /** Вызывается после финального сохранения. */
  onDone: () => void;
  /** «Позже» в туре: ответы и шаг сохранены, тур отложен. */
  onLater?: () => void;
};

/**
 * Анкета танцора в мобильном приложении: уровень обязателен, направления и цель — нет.
 *
 * Ответы сохраняются на каждом шаге, как и на вебе: прерванный тур продолжается
 * с того места, где остановился, а не начинается заново.
 */
export function DancerTour({ mode, initial, onDone, onLater }: Props) {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const d = c.onboarding.dancer;
  const insets = useSafeAreaInsets();

  const [stepIndex, setStepIndex] = useState(0);
  const [level, setLevel] = useState<DancerLevel | null>(initial?.level ?? null);
  const [picked, setPicked] = useState<string[]>(initial?.styles ?? []);
  const [goal, setGoal] = useState(initial?.goal ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step: Step = STEPS[stepIndex];
  const progress = useSharedValue((1 / STEPS.length) * 100);

  // Прерванный тур продолжается с того же шага; без выбранного уровня — всегда с первого.
  useEffect(() => {
    if (mode !== 'onboarding' || !initial?.level) return;
    let alive = true;
    loadOnboardingStep().then((saved) => {
      if (alive && saved !== null) setStepIndex(Math.min(saved, STEPS.length - 1));
    });
    return () => {
      alive = false;
    };
  }, [mode, initial?.level]);

  useEffect(() => {
    progress.value = withTiming(((stepIndex + 1) / STEPS.length) * 100, { duration: 360, easing: EASE_OUT });
  }, [stepIndex, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  function toggleStyle(style: string) {
    setPicked((prev) => (prev.includes(style) ? prev.filter((item) => item !== style) : [...prev, style]));
  }

  /** Сохраняет текущие ответы. Возвращает `false`, если сохранить не удалось или уровень не выбран. */
  async function persist(completed: boolean): Promise<boolean> {
    if (saving) return false;
    if (!level) {
      setError(c.validation.required);
      return false;
    }
    setError(null);
    setSaving(true);
    try {
      await saveDancerProfile({ level, styles: picked, goal, note, completed });
      return true;
    } catch (failure) {
      hapticError();
      setError(serverMessageOf(failure) ?? t.catalogError);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onNext() {
    // в режиме правки анкета уже засчитана — не сбрасываем «тур пройден» на промежуточном шаге
    if (!(await persist(mode === 'edit'))) return;
    const next = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(next);
    if (mode === 'onboarding') void saveOnboardingStep(next);
  }

  async function onFinish() {
    if (!(await persist(true))) return;
    hapticSuccess();
    void clearOnboardingProgress();
    onDone();
  }

  /** Необязательный шаг пропускается с пустыми ответами, ранее введённое на нём не сохраняется. */
  async function onSkip() {
    if (step === 'styles') {
      setPicked([]);
      if (!level) return;
      setSaving(true);
      try {
        await saveDancerProfile({ level, styles: [], goal, note, completed: mode === 'edit' });
        setStepIndex(STEPS.length - 1);
        if (mode === 'onboarding') void saveOnboardingStep(STEPS.length - 1);
      } catch (failure) {
        setError(serverMessageOf(failure) ?? t.catalogError);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 'goal') await onFinish();
  }

  async function onLaterPress() {
    if (saving || !onLater) return;
    // Уровень обязателен: без него сохранять нечего, тур просто откладывается.
    if (level && !(await persist(false))) return;
    await saveOnboardingStep(stepIndex);
    await snoozeOnboarding();
    onLater();
  }

  const stepTitle =
    step === 'level' ? d.level.title : step === 'styles' ? d.styles.title : d.goal.title;
  const stepHint =
    step === 'level' ? d.level.hint : step === 'styles' ? d.styles.hint : d.goal.hint;
  const isLast = stepIndex === STEPS.length - 1;
  const canAdvance = step !== 'level' || level !== null;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBlock}>
        <View style={styles.progressTop}>
          <Text style={type.eyebrow}>
            {d.step.replace('{current}', String(stepIndex + 1)).replace('{total}', String(STEPS.length))}
          </Text>
          {step !== 'level' ? (
            <Pressable onPress={onSkip} disabled={saving} hitSlop={12} accessibilityRole="button" style={styles.topAction}>
              <Text style={styles.topActionText}>{t.onboardingSkip}</Text>
            </Pressable>
          ) : mode === 'onboarding' && onLater ? (
            <Pressable onPress={onLaterPress} disabled={saving} hitSlop={12} accessibilityRole="button" style={styles.topAction}>
              <Text style={styles.topActionText}>{t.onboardingLater}</Text>
            </Pressable>
          ) : (
            <Text style={styles.progressLabel}>{d.progressLabel}</Text>
          )}
        </View>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel={d.progressLabel}
          accessibilityValue={{ min: 1, max: STEPS.length, now: stepIndex + 1 }}
        >
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Animated.View key={step} entering={FadeIn.duration(280).easing(EASE_OUT)} style={styles.stepBody}>
          <Text style={type.h2}>{stepTitle}</Text>
          <Text style={styles.hint}>{stepHint}</Text>

          {step === 'level' ? (
            <View style={styles.stack} accessibilityRole="radiogroup" accessibilityLabel={stepTitle}>
              {LEVELS.map((item, index) => {
                const active = level === item;
                return (
                  <Animated.View key={item} entering={enterItem(index)}>
                    <PressableScale
                      onPress={() => setLevel(item)}
                      disabled={saving}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active, disabled: saving }}
                      accessibilityLabel={levelLabel(item, c)}
                      style={[styles.card, active && styles.cardActive]}
                    >
                      <View style={styles.cardBody}>
                        <Text style={type.h3}>{levelLabel(item, c)}</Text>
                        <Text style={styles.hint}>{d.level[LEVEL_KEY[item]].description}</Text>
                      </View>
                      {active ? <Ionicons name="checkmark-circle" size={22} color={colors.accentBright} /> : null}
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          ) : null}

          {step === 'styles' ? (
            <>
              <Text style={styles.meta}>
                {picked.length === 0
                  ? d.styles.optional
                  : plural(d.styles.selected, picked.length, locale)}
              </Text>
              <View style={styles.chips}>
                {PICKABLE_STYLES.map((style, index) => {
                  const selected = picked.includes(style);
                  return (
                    <Animated.View key={style} entering={enterItem(index)}>
                      <PressableScale
                        onPress={() => toggleStyle(style)}
                        disabled={saving}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected, disabled: saving }}
                        accessibilityLabel={styleLabel(style, c)}
                        style={[styles.chip, selected && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{styleLabel(style, c)}</Text>
                      </PressableScale>
                    </Animated.View>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 'goal' ? (
            <View style={styles.stack}>
              <Text style={styles.meta}>{d.goal.optional}</Text>
              <Text style={type.eyebrow}>{d.goal.goalLabel}</Text>
              <TextInput
                value={goal}
                onChangeText={setGoal}
                editable={!saving}
                accessibilityLabel={d.goal.goalLabel}
                placeholder={d.goal.goalPlaceholder}
                placeholderTextColor={colors.text3}
                multiline
                maxLength={500}
                textAlignVertical="top"
                style={styles.input}
              />
              <Text style={type.eyebrow}>{d.goal.noteLabel}</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                editable={!saving}
                accessibilityLabel={d.goal.noteLabel}
                placeholder={d.goal.notePlaceholder}
                placeholderTextColor={colors.text3}
                multiline
                maxLength={500}
                textAlignVertical="top"
                style={styles.input}
              />
              <Text style={styles.hint}>{d.goal.visibleToInstructor}</Text>
            </View>
          ) : null}
        </Animated.View>

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
        {stepIndex > 0 ? (
          <Button
            label={d.back}
            variant="ghost"
            icon="chevron-back"
            onPress={() => setStepIndex((index) => Math.max(index - 1, 0))}
            disabled={saving}
            style={styles.footerButton}
          />
        ) : null}
        {isLast ? (
          <Button label={saving ? d.saving : d.finish} onPress={onFinish} busy={saving} style={styles.footerButton} />
        ) : (
          <Button
            label={saving ? d.saving : d.next}
            onPress={onNext}
            busy={saving}
            disabled={!canAdvance}
            style={styles.footerButton}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  progressBlock: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressLabel: { fontSize: 12, color: colors.text3 },
  topAction: { minHeight: 32, justifyContent: 'center' },
  topActionText: { fontSize: 14, fontWeight: '700', color: colors.accentText },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.accentBright },
  body: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xl, gap: space.lg },
  stepBody: { gap: space.sm },
  hint: { ...type.bodySm, color: colors.text2 },
  meta: { fontSize: 12, color: colors.text3 },
  stack: { gap: space.md, marginTop: space.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(245,241,234,0.06)',
  },
  cardActive: { borderColor: colors.accentBright },
  cardBody: { flex: 1, gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accentBright, backgroundColor: colors.accent },
  chipText: { ...type.bodySm, color: colors.text },
  chipTextActive: { color: colors.white },
  input: {
    ...type.body,
    minHeight: 96,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  error: { ...type.bodySm, color: colors.danger },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  footerButton: { flex: 1 },
});
