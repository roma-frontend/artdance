import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { catalogFor } from '@/i18n/catalog';
import { deviceLocale, messagesFor } from '@/lib/i18n';
import { unsubscribeNewsletter } from '@/lib/newsletter';
import { colors, space } from '@/theme';

type Outcome = 'pending' | 'unsubscribed' | 'expired' | 'failed';

/** Отписка от рассылки по ссылке из письма. Открывается без входа, как и на вебе. */
export default function NewsletterUnsubscribeScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const locale = deviceLocale(undefined);
  const c = catalogFor(locale);
  const t = messagesFor(locale);
  const n = c.home.newsletter;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [outcome, setOutcome] = useState<Outcome>('pending');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setOutcome('pending');
    unsubscribeNewsletter(token)
      .then((ok) => {
        if (alive) setOutcome(ok ? 'unsubscribed' : 'expired');
      })
      .catch(() => {
        if (alive) setOutcome('failed');
      });
    return () => {
      alive = false;
    };
  }, [token, attempt]);

  const style = [styles.screen, { paddingTop: insets.top + space.xl }];

  if (outcome === 'pending') {
    return (
      <View style={style}>
        <ActivityIndicator color={colors.accentBright} />
      </View>
    );
  }
  if (outcome === 'unsubscribed') {
    return (
      <View style={style}>
        <EmptyState
          icon="mail-unread-outline"
          title={n.unsubscribed}
          body={n.unsubscribedHint}
          actionLabel={n.homeCta}
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }
  if (outcome === 'expired') {
    return (
      <View style={style}>
        <EmptyState
          icon="alert-circle-outline"
          title={n.linkExpired}
          body={n.linkExpiredHint}
          actionLabel={n.homeCta}
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }
  return (
    <View style={style}>
      <EmptyState
        icon="cloud-offline-outline"
        title={t.catalogError}
        actionLabel={c.common.actions.retry}
        onAction={() => setAttempt((a) => a + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
