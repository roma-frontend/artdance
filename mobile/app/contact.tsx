import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { captchaRequired, TurnstileChallenge } from '@/components/ui/turnstile-challenge';
import { backLabel, goBack } from '@/lib/navigation';
import { catalogFor } from '@/i18n/catalog';
import { ContactError, getContact, sendContact, type ContactContent } from '@/lib/content';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { enterItem, EASE_OUT } from '@/lib/motion';
import { serverMessageOf } from '@/lib/server-message';
import { colors, radius, space, type } from '@/theme';

type Field = 'name' | 'email' | 'message';
const FIELDS: readonly string[] = ['name', 'email', 'message'];

export default function ContactScreen() {
  const locale = deviceLocale(undefined);
  const t = messagesFor(locale);
  const c = catalogFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<ContactContent | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: Field; text: string } | null>(null);
  const [sent, setSent] = useState<{ delivered: boolean; email: string } | null>(null);
  const [unsent, setUnsent] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getContact(locale)
      .then((next) => {
        if (!alive) return;
        setContent(next);
        setTopic(next.form.defaultTopic);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  if (content === null && !failed) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }

  function open(url: string) {
    Linking.openURL(url).catch(() => undefined);
  }

  async function submit() {
    if (!content) return;
    const trimmedEmail = email.trim();
    setBusy(true);
    setFieldError(null);
    setUnsent(null);
    try {
      const outcome = await sendContact({
        name: name.trim(),
        email: trimmedEmail,
        topic,
        message: message.trim(),
        locale,
        captchaToken,
      });
      setSent({ delivered: outcome.delivered, email: trimmedEmail });
    } catch (e) {
      if (e instanceof ContactError && e.field && FIELDS.includes(e.field)) {
        const field = e.field as Field;
        setFieldError({ field, text: field === 'email' ? content.errors.email : content.errors.required });
      } else {
        // Капча и сбои сети: показываем ошибку и даём повторить отправку в приложении.
        setUnsent(serverMessageOf(e) ?? content.outcome.failedBody);
      }
      // Токен одноразовый: после неудачи проверка проходится заново.
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    name.trim().length >= 2 && email.trim().length > 0 && message.trim().length >= 10 && (!captchaRequired || captchaToken !== null);
  const delivered = sent?.delivered === true;
  const failedNotice = unsent !== null || (sent !== null && !sent.delivered);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={backLabel()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{c.footer.contact}</Text>
      </Animated.View>

      {content === null ? (
        <EmptyState icon="alert-circle-outline" title={t.catalogError} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Text style={type.bodySm}>{content.subtitle}</Text>
          <Text style={type.caption}>{content.responseTime}</Text>

          {delivered ? (
            <View style={styles.card}>
              <Text style={type.h3}>{content.outcome.successTitle}</Text>
              <Text style={type.bodySm}>{content.outcome.successBody.replace('{email}', sent?.email ?? '')}</Text>
            </View>
          ) : (
            <>
              {failedNotice ? (
                <View style={styles.card}>
                  <Text style={type.h3}>{content.outcome.failedTitle}</Text>
                  <Text style={type.bodySm}>{unsent ?? content.outcome.failedBody}</Text>
                </View>
              ) : null}

              <Animated.View entering={enterItem(0)} style={styles.card}>
                <Text style={type.h3}>{content.form.title}</Text>

                <LabeledField label={content.form.nameLabel} error={fieldError?.field === 'name' ? fieldError.text : undefined}>
                  <TextInput value={name} onChangeText={setName} style={styles.input} autoComplete="name" textContentType="name" />
                </LabeledField>

                <LabeledField label={content.form.emailLabel} error={fieldError?.field === 'email' ? fieldError.text : undefined}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                </LabeledField>

                <View style={styles.field}>
                  <Text style={type.label}>{content.form.topicLabel}</Text>
                  <View style={styles.chips}>
                    {content.form.topics.map((option) => {
                      const active = option.value === topic;
                      return (
                        <PressableScale key={option.value} onPress={() => setTopic(option.value)} accessibilityRole="button">
                          <View style={[styles.chip, active && styles.chipActive]}>
                            <Text style={[type.caption, active && styles.chipTextActive]}>{option.label}</Text>
                          </View>
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>

                <LabeledField label={content.form.messageLabel} error={fieldError?.field === 'message' ? fieldError.text : undefined}>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    style={[styles.input, styles.multiline]}
                    placeholder={content.form.messagePlaceholder}
                    placeholderTextColor={colors.text3}
                    multiline
                    textAlignVertical="top"
                  />
                </LabeledField>

                <TurnstileChallenge onToken={setCaptchaToken} resetKey={captchaKey} />
                <Button label={content.form.submit} onPress={submit} busy={busy} disabled={!canSubmit} />
              </Animated.View>
            </>
          )}

          <Animated.View entering={enterItem(1)} style={styles.card}>
            <Text style={type.h3}>{content.channelsTitle}</Text>
            {content.channels.map((channel) => {
              const href = channel.href;
              return (
                <View key={channel.id} style={styles.channel}>
                  <Text style={type.title}>{channel.title}</Text>
                  <Text style={type.bodySm}>{channel.note}</Text>
                  {href && channel.value ? (
                    <PressableScale onPress={() => open(href)} accessibilityRole="link">
                      <Text style={[type.label, styles.link]}>{channel.value}</Text>
                    </PressableScale>
                  ) : null}
                </View>
              );
            })}
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

function LabeledField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: 60, gap: space.md },
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(245,241,234,0.06)', gap: space.sm },
  channel: { gap: space.xs, paddingTop: space.sm },
  link: { color: colors.accentText },
  field: { gap: space.xs },
  input: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 16,
  },
  multiline: { minHeight: 120 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  chipActive: { borderColor: colors.accentBright, backgroundColor: 'rgba(201,169,106,0.12)' },
  chipTextActive: { color: colors.accentBright },
});
