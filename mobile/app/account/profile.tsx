import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useCachedState } from '@/lib/use-cached-state';
import { Image, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarCropModal } from '@/components/account/avatar-crop-modal';
import { FloatingInput } from '@/components/auth/floating-input';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Segmented } from '@/components/ui/segmented';
import {
  AccountProfileError,
  loadAccountProfile,
  removeAvatar,
  saveAccountPreferences,
  uploadAvatar,
  type AccountProfile,
  type AvatarCropRect,
  type PickedImage,
} from '@/lib/account-profile';
import { chooseLocale, useLocale } from '@/lib/app-locale';
import { AuthError, changePassword, getCurrentUser, updateName, type User } from '@/lib/auth';
import { initials } from '@/lib/format';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { messagesFor, type Locale } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { colors, gradients, radius, space, type } from '@/theme';

const MIN_PASSWORD_LENGTH = 10;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const DEFAULT_TIME_ZONE = 'Asia/Yerevan';
/** Часовые пояса, которые чаще всего нужны клиентам студии. */
const TIME_ZONES: readonly string[] = [
  'Asia/Yerevan',
  'Europe/Moscow',
  'Europe/Berlin',
  'Europe/London',
  'Asia/Dubai',
  'Asia/Tbilisi',
  'Asia/Tokyo',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];
const LOCALE_OPTIONS: { key: Locale; label: string }[] = [
  { key: 'hy', label: 'Հայերեն' },
  { key: 'ru', label: 'Русский' },
  { key: 'en', label: 'English' },
];

type Notice = { ok: boolean; text: string };

/** Настройки профиля: имя и пароль. Адрес и роль меняются через поддержку. */
export default function ProfileScreen() {
  const locale = useLocale();
  const t = messagesFor(locale);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const scroll = useRef<ScrollViewInstance>(null);
  const passwordY = useRef(0);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useCachedState<AccountProfile>('account.profile', 'user');
  const [loaded, setLoaded] = useState(false);
  const [cropImage, setCropImage] = useState<PickedImage | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState<Notice | null>(null);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [zoneNotice, setZoneNotice] = useState<Notice | null>(null);
  const [languageNotice, setLanguageNotice] = useState<Notice | null>(null);
  const [name, setName] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameNotice, setNameNotice] = useState<Notice | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getCurrentUser().catch(() => null), loadAccountProfile().catch(() => null)]).then(([found, loaded]) => {
      if (!alive) return;
      setUser(found);
      setName(found?.name ?? '');
      setProfile(loaded);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const trimmedName = name.trim();
  const nameReady = trimmedName.length > 0 && trimmedName !== user?.name;
  const passwordReady = current.length > 0 && next.length >= MIN_PASSWORD_LENGTH;

  const currentZone = profile?.timeZone ?? DEFAULT_TIME_ZONE;
  const zones = TIME_ZONES.includes(currentZone) ? TIME_ZONES : [currentZone, ...TIME_ZONES];

  function avatarFailure(error: unknown): string {
    const status = error instanceof AccountProfileError ? error.status : 0;
    if (status === 413) return t.profilePhotoTooLarge;
    if (status === 415) return t.profilePhotoBadType;
    if (status === 422) return t.profileAvatarUnreadable;
    return t.genericError;
  }

  async function pickAvatar() {
    setAvatarNotice(null);
    try {
      // Системная галерея (Photo Picker на Android, PHPicker на iOS), а не Файлы.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: false,
        quality: 1,
        // HEIC с iPhone сервер не декодирует, просим iOS отдать JPEG.
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? '';
      if (!IMAGE_TYPES.includes(mimeType)) {
        setAvatarNotice({ ok: false, text: t.profilePhotoBadType });
        return;
      }
      // Исходник может быть больше 2 МБ: сервер кадрирует и сжимает его сам.
      if (asset.fileSize != null && asset.fileSize > MAX_SOURCE_BYTES) {
        setAvatarNotice({ ok: false, text: t.profilePhotoTooLarge });
        return;
      }
      setCropImage({ uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', mimeType });
    } catch {
      setAvatarNotice({ ok: false, text: t.genericError });
    }
  }

  async function applyCrop(crop: AvatarCropRect) {
    if (!cropImage) return;
    setAvatarBusy(true);
    setAvatarNotice(null);
    try {
      const saved = await uploadAvatar(cropImage, crop);
      setProfile(saved);
      setCropImage(null);
      hapticSuccess();
      setAvatarNotice({ ok: true, text: t.profilePhotoSaved });
    } catch (error: unknown) {
      if (__DEV__) console.warn('[avatar] upload failed', error);
      hapticError();
      setAvatarNotice({ ok: false, text: avatarFailure(error) });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function dropAvatar() {
    setAvatarBusy(true);
    setAvatarNotice(null);
    try {
      setProfile(await removeAvatar());
      setAvatarNotice({ ok: true, text: t.profilePhotoRemoved });
    } catch {
      setAvatarNotice({ ok: false, text: t.genericError });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function pickTimeZone(zone: string) {
    if (zone === currentZone) return;
    setZoneBusy(true);
    setZoneNotice(null);
    try {
      setProfile(await saveAccountPreferences({ timeZone: zone }));
      setZoneNotice({ ok: true, text: t.profileTimeZoneSaved });
    } catch {
      setZoneNotice({ ok: false, text: t.genericError });
    } finally {
      setZoneBusy(false);
    }
  }

  async function pickLocale(code: Locale) {
    setLanguageNotice(null);
    try {
      // Сначала сохраняем на сервере: при ошибке язык интерфейса не меняется.
      const saved = await saveAccountPreferences({ locale: code });
      await chooseLocale(code);
      setProfile(saved);
      setLanguageNotice({ ok: true, text: messagesFor(code).profileLanguageSaved });
    } catch {
      setLanguageNotice({ ok: false, text: t.genericError });
    }
  }

  async function saveName() {
    if (nameBusy) return;
    setNameBusy(true);
    setNameNotice(null);
    try {
      await updateName(trimmedName);
      setUser((prev) => (prev ? { ...prev, name: trimmedName } : prev));
      // Свежий профиль рассылается подписчикам: вкладки сразу показывают новое имя.
      loadAccountProfile().catch(() => undefined);
      hapticSuccess();
      setNameNotice({ ok: true, text: t.profileSaved });
    } catch {
      hapticError();
      setNameNotice({ ok: false, text: t.genericError });
    } finally {
      setNameBusy(false);
    }
  }

  async function savePassword() {
    if (passwordBusy) return;
    setPasswordBusy(true);
    setPasswordNotice(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      hapticSuccess();
      setPasswordNotice({ ok: true, text: t.profilePasswordChanged });
    } catch (error: unknown) {
      hapticError();
      const code = error instanceof AuthError ? error.message : '';
      setPasswordNotice({ ok: false, text: code === 'INVALID_PASSWORD' ? t.profileWrongPassword : t.genericError });
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeInDown.duration(420).easing(EASE_OUT)} style={styles.header}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.accountCancel} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <Text style={type.h2}>{t.profileTitle}</Text>
      </Animated.View>

      {!loaded ? null : user === null ? (
        <Text style={[type.bodySm, styles.pad]}>{t.accountEmpty}</Text>
      ) : (
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]}
        >
          <Animated.View entering={FadeInDown.delay(60).duration(420).easing(EASE_OUT)} style={styles.card}>
            <Text style={type.h3}>{t.profilePhotoTitle}</Text>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                {profile?.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.avatarFill} />
                ) : (
                  <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarFill}>
                    <Text style={styles.avatarText}>{initials(user.name)}</Text>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.flex}>
                <Text style={styles.hint}>{t.profilePhotoHint}</Text>
                <Text style={styles.rules}>{t.profilePhotoLimit}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Button label={t.profilePhotoChange} onPress={pickAvatar} variant="ghost" busy={avatarBusy} disabled={avatarBusy} style={styles.flex} />
              {profile?.avatarUrl ? (
                <Button label={t.profilePhotoRemove} onPress={dropAvatar} variant="ghost" disabled={avatarBusy} style={styles.flex} />
              ) : null}
            </View>
            {avatarNotice ? (
              <Animated.Text entering={FadeInDown.duration(250)} style={avatarNotice.ok ? styles.ok : styles.error}>
                {avatarNotice.text}
              </Animated.Text>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(420).easing(EASE_OUT)} style={styles.card}>
            <Text style={type.h3}>{t.name}</Text>
            <FloatingInput
              label={t.name}
              icon="person-outline"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setNameNotice(null);
              }}
              autoComplete="name"
              textContentType="name"
            />
            <Button label={t.profileSave} onPress={saveName} busy={nameBusy} disabled={!nameReady || nameBusy} />
            {nameNotice ? (
              <Animated.Text entering={FadeInDown.duration(250)} style={nameNotice.ok ? styles.ok : styles.error}>
                {nameNotice.text}
              </Animated.Text>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(420).easing(EASE_OUT)} style={styles.card}>
            <Text style={type.h3}>{t.profileLanguageTitle}</Text>
            <Text style={styles.hint}>{t.profileLanguageHint}</Text>
            <Segmented options={LOCALE_OPTIONS} value={locale} onChange={pickLocale} />
            {languageNotice ? (
              <Animated.Text entering={FadeInDown.duration(250)} style={languageNotice.ok ? styles.ok : styles.error}>
                {languageNotice.text}
              </Animated.Text>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(130).duration(420).easing(EASE_OUT)} style={styles.card}>
            <Text style={type.h3}>{t.profileTimeZoneTitle}</Text>
            <Text style={styles.hint}>{t.profileTimeZoneHint}</Text>
            <View style={styles.chips}>
              {zones.map((zone) => {
                const active = zone === currentZone;
                return (
                  <PressableScale
                    key={zone}
                    onPress={() => pickTimeZone(zone)}
                    disabled={zoneBusy}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: zoneBusy }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{zone}</Text>
                  </PressableScale>
                );
              })}
            </View>
            {zoneNotice ? (
              <Animated.Text entering={FadeInDown.duration(250)} style={zoneNotice.ok ? styles.ok : styles.error}>
                {zoneNotice.text}
              </Animated.Text>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(140).duration(420).easing(EASE_OUT)}
            style={styles.card}
            onLayout={(event) => {
              passwordY.current = event.nativeEvent.layout.y;
              if (focus === 'password') scroll.current?.scrollTo({ y: passwordY.current - space.xl, animated: true });
            }}
          >
            <Text style={type.h3}>{t.profilePasswordTitle}</Text>
            <FloatingInput
              label={t.profileCurrentPassword}
              icon="lock-closed-outline"
              value={current}
              onChangeText={(value) => {
                setCurrent(value);
                setPasswordNotice(null);
              }}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
            />
            <FloatingInput
              label={t.profileNewPassword}
              icon="key-outline"
              value={next}
              onChangeText={(value) => {
                setNext(value);
                setPasswordNotice(null);
              }}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Text style={styles.rules}>{t.profilePasswordRules}</Text>
            <Button label={t.profileSave} onPress={savePassword} busy={passwordBusy} disabled={!passwordReady || passwordBusy} />
            {passwordNotice ? (
              <Animated.Text entering={FadeInDown.duration(250)} style={passwordNotice.ok ? styles.ok : styles.error}>
                {passwordNotice.text}
              </Animated.Text>
            ) : null}
          </Animated.View>
        </ScrollView>
      )}

      <AvatarCropModal
        image={cropImage}
        busy={avatarBusy}
        notice={avatarNotice && !avatarNotice.ok ? avatarNotice.text : null}
        onCancel={() => setCropImage(null)}
        onConfirm={applyCrop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg },
  body: { paddingHorizontal: space.xl, gap: space.md },
  pad: { paddingHorizontal: space.xl },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(245,241,234,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  rules: { fontSize: 12, color: colors.text3 },
  hint: { fontSize: 13, color: colors.text2, lineHeight: 18 },
  flex: { flex: 1 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  avatarFill: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700', color: colors.white },
  actions: { flexDirection: 'row', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: 'rgba(245,241,234,0.04)',
  },
  chipActive: { backgroundColor: 'rgba(201,59,82,0.18)', borderColor: colors.accentBright },
  chipText: { fontSize: 13, color: colors.text2 },
  chipTextActive: { color: colors.text, fontWeight: '600' },
  ok: { fontSize: 13, color: colors.metal, fontWeight: '600' },
  error: { fontSize: 13, color: colors.accentBright },
});
