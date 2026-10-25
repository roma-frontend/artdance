import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { catalogFor } from '@/i18n/catalog';
import {
  APPLICATION_DOCUMENT_MAX_BYTES,
  APPLICATION_DOCUMENT_MAX_COUNT,
  APPLICATION_STYLES,
  clearApplicationDraft,
  loadApplicationDraft,
  saveApplicationDraft,
  submitInstructorApplication,
  type ApplicationDocumentDraft,
  type ApplicationDocumentKind,
} from '@/lib/instructor-application';
import { styleLabel } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

/** Порядок шагов совпадает с ключами `instructorApply.steps`. */
const STEP_KEYS = ['about', 'experience', 'documents'] as const;
const DOCUMENT_KINDS: readonly ApplicationDocumentKind[] = ['identity', 'diploma', 'certificate'];
/** Форматы, которые пикер предлагает; сервер всё равно проверяет сигнатуру файла. */
const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN = 2;
const NAME_MAX = 80;
const BIO_MIN = 10;
const BIO_MAX = 2000;
const PHONE_MAX = 20;
const MAX_DOCUMENT_MB = APPLICATION_DOCUMENT_MAX_BYTES / (1024 * 1024);

function fill(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

/**
 * Заявка исполнителя: три шага с валидацией, которая повторяет правила сервера.
 *
 * Текст заявки сохраняется в черновик на каждом изменении. Документы в черновик не
 * попадают: их URI живут в кеше пикера, и после перезапуска их придётся прикрепить заново.
 */
export default function InstructorApplyScreen() {
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const a = c.instructorApply;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [documents, setDocuments] = useState<ApplicationDocumentDraft[]>([]);
  const [pendingKind, setPendingKind] = useState<ApplicationDocumentKind>('identity');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    loadApplicationDraft().then((saved) => {
      if (!alive) return;
      if (saved) {
        setName(saved.name);
        setEmail(saved.email);
        setPhone(saved.phone);
        setBio(saved.bio);
        setPicked(saved.styles.filter((style) => (APPLICATION_STYLES as readonly string[]).includes(style)));
        setStep(Math.min(Math.max(saved.step, 0), STEP_KEYS.length - 1));
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || done) return;
    void saveApplicationDraft({ name, email, phone, bio, styles: picked, step });
  }, [ready, done, name, email, phone, bio, picked, step]);

  function validateAbout(): string | null {
    const trimmedName = name.trim();
    if (trimmedName === '') return c.validation.required;
    if (trimmedName.length < NAME_MIN) return fill(c.validation.minLength, { min: NAME_MIN });
    const trimmedEmail = email.trim();
    if (trimmedEmail === '') return c.validation.required;
    if (!EMAIL_PATTERN.test(trimmedEmail)) return c.validation.email;
    return null;
  }

  function validateExperience(): string | null {
    const trimmedBio = bio.trim();
    if (trimmedBio === '') return c.validation.required;
    if (trimmedBio.length < BIO_MIN) return fill(c.validation.minLength, { min: BIO_MIN });
    if (picked.length === 0) return a.fields.stylesHint;
    return null;
  }

  function validateDocuments(): string | null {
    if (documents.length < 1) return a.errors.documentsRequired;
    return null;
  }

  const validators = [validateAbout, validateExperience, validateDocuments];

  function togglePicked(style: string) {
    setPicked((prev) => (prev.includes(style) ? prev.filter((item) => item !== style) : [...prev, style]));
  }

  function goBack() {
    setError(null);
    if (step > 0) {
      setStep(step - 1);
    } else {
      router.back();
    }
  }

  function goNext() {
    const problem = validators[step]();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep(Math.min(step + 1, STEP_KEYS.length - 1));
  }

  async function addDocument() {
    setError(null);
    if (documents.length >= APPLICATION_DOCUMENT_MAX_COUNT) {
      setError(fill(a.errors.tooManyDocuments, { max: APPLICATION_DOCUMENT_MAX_COUNT }));
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_TYPES,
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (asset.size != null && asset.size > APPLICATION_DOCUMENT_MAX_BYTES) {
        setError(fill(a.errors.fileTooLarge, { max: MAX_DOCUMENT_MB }));
        return;
      }

      setDocuments((prev) => [
        ...prev,
        {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType ?? null,
          size: asset.size ?? null,
          kind: pendingKind,
        },
      ]);
    } catch {
      setError(a.errors.pickFailed);
    }
  }

  function removeDocument(index: number) {
    setDocuments((prev) => prev.filter((_, position) => position !== index));
  }

  async function onSubmit() {
    setError(null);
    for (let index = 0; index < validators.length; index += 1) {
      const problem = validators[index]();
      if (problem) {
        setError(problem);
        setStep(index);
        return;
      }
    }

    setSubmitting(true);
    try {
      await submitInstructorApplication({
        name,
        email,
        phone,
        bio,
        styles: picked,
        documents,
      });
      setDone(true);
      await clearApplicationDraft();
    } catch (failure) {
      setError(serverMessageOf(failure) ?? a.errors.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View
        style={[
          styles.screen,
          styles.center,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl },
        ]}
      >
        <Ionicons name="checkmark-circle" size={56} color={colors.accentBright} />
        <Text style={[type.h2, styles.centerText]}>{a.success.title}</Text>
        <Text style={[styles.hint, styles.centerText]}>{a.success.body}</Text>
        <Button label={a.success.done} onPress={() => router.back()} style={styles.successButton} />
      </View>
    );
  }

  const isLast = step === STEP_KEYS.length - 1;
  const progress = ((step + 1) / STEP_KEYS.length) * 100;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel={a.actions.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{a.title}</Text>
      </View>

      <View style={styles.progressBlock}>
        <Text style={type.eyebrow}>{fill(a.stepOf, { current: step + 1, total: STEP_KEYS.length })}</Text>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: STEP_KEYS.length, now: step + 1 }}
        >
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Animated.View key={step} entering={FadeIn.duration(280).easing(EASE_OUT)} style={styles.stepBody}>
          <Text style={type.h2}>{a.steps[STEP_KEYS[step]]}</Text>

          {step === 0 ? (
            <View style={styles.stack}>
              <Text style={type.eyebrow}>{a.fields.name}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={NAME_MAX}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                style={styles.input}
              />
              <Text style={type.eyebrow}>{a.fields.email}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.input}
              />
              <Text style={type.eyebrow}>{a.fields.phone}</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={PHONE_MAX}
                textContentType="telephoneNumber"
                style={styles.input}
              />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.stack}>
              <Text style={type.eyebrow}>{a.fields.bio}</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={BIO_MAX}
                textAlignVertical="top"
                style={[styles.input, styles.multiline]}
              />
              <Text style={type.eyebrow}>{a.fields.styles}</Text>
              <Text style={styles.meta}>{a.fields.stylesHint}</Text>
              <View style={styles.chips}>
                {APPLICATION_STYLES.map((style) => {
                  const selected = picked.includes(style);
                  return (
                    <PressableScale
                      key={style}
                      onPress={() => togglePicked(style)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={styleLabel(style, c)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{styleLabel(style, c)}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.stack}>
              <Text style={styles.hint}>{a.documents.hint}</Text>
              <Text style={styles.meta}>
                {fill(a.documents.count, { count: documents.length, max: APPLICATION_DOCUMENT_MAX_COUNT })}
              </Text>
              {documents.length === 0 ? <Text style={styles.hint}>{a.documents.empty}</Text> : null}

              {documents.map((document, index) => (
                <View key={`${document.uri}-${index}`} style={styles.docRow}>
                  <Ionicons name="document-text-outline" size={22} color={colors.accentBright} />
                  <View style={styles.docBody}>
                    <Text style={type.bodySm} numberOfLines={1}>
                      {document.name}
                    </Text>
                    <Text style={styles.meta}>{a.documents.kind[document.kind]}</Text>
                  </View>
                  <PressableScale
                    onPress={() => removeDocument(index)}
                    accessibilityRole="button"
                    accessibilityLabel={a.documents.remove}
                  >
                    <Ionicons name="close-circle-outline" size={22} color={colors.text3} />
                  </PressableScale>
                </View>
              ))}

              <View style={styles.chips}>
                {DOCUMENT_KINDS.map((kind) => {
                  const selected = pendingKind === kind;
                  return (
                    <PressableScale
                      key={kind}
                      onPress={() => setPendingKind(kind)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{a.documents.kind[kind]}</Text>
                    </PressableScale>
                  );
                })}
              </View>

              <Button
                label={a.documents.add}
                variant="ghost"
                icon="add"
                onPress={addDocument}
                disabled={documents.length >= APPLICATION_DOCUMENT_MAX_COUNT || submitting}
              />
              <Text style={styles.meta}>{a.documents.privacy}</Text>
            </View>
          ) : null}
        </Animated.View>

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {step > 0 ? (
          <Button
            label={a.actions.back}
            variant="ghost"
            icon="chevron-back"
            onPress={goBack}
            disabled={submitting}
            style={styles.footerButton}
          />
        ) : null}
        {isLast ? (
          <Button
            label={a.actions.submit}
            onPress={onSubmit}
            busy={submitting}
            style={styles.footerButton}
          />
        ) : (
          <Button label={a.actions.next} onPress={goNext} style={styles.footerButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md },
  centerText: { textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  progressBlock: { paddingHorizontal: space.xl, gap: space.sm },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.accentBright },
  body: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xl, gap: space.lg },
  stepBody: { gap: space.sm },
  stack: { gap: space.sm, marginTop: space.md },
  hint: { ...type.bodySm, color: colors.text2 },
  meta: { fontSize: 12, color: colors.text3 },
  input: {
    ...type.body,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  multiline: { minHeight: 120 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accentBright, backgroundColor: colors.accent },
  chipText: { ...type.bodySm, color: colors.text },
  chipTextActive: { color: colors.white },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(245,241,234,0.06)',
  },
  docBody: { flex: 1, gap: space.xs },
  error: { ...type.bodySm, color: colors.danger },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  footerButton: { flex: 1 },
  successButton: { alignSelf: 'stretch', marginTop: space.lg },
});
