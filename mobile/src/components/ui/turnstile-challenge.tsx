import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { API_URL, TURNSTILE_SITE_KEY } from '@/lib/config';

/** Капча нужна, только если сервер её настроил (ключ сайта задан в окружении приложения). */
export const captchaRequired = TURNSTILE_SITE_KEY.length > 0;

/*
 * Виджет Cloudflare грузится в WebView с origin API: домен, на котором выдан ключ,
 * должен совпадать с адресом сервера. Токен уходит в приложение через postMessage.
 */
function challengeHtml(siteKey: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:transparent;display:flex;justify-content:center">
<div id="c"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
<script>
  var post = function (token) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ token: token }));
  };
  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;
    if (window.turnstile) {
      clearInterval(timer);
      window.turnstile.render('#c', {
        sitekey: ${JSON.stringify(siteKey)},
        theme: 'dark',
        callback: function (token) { post(token); },
        'expired-callback': function () { post(null); },
        'error-callback': function () { post(null); }
      });
    } else if (tries > 100) {
      clearInterval(timer);
      post(null);
    }
  }, 100);
</script></body></html>`;
}

/**
 * Виджет капчи для формы. Сообщает токен через `onToken`; `null` — токена нет (истёк, ошибка).
 * Токен одноразовый: после неудачной отправки родитель перемонтирует виджет через `resetKey`.
 */
export function TurnstileChallenge({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const html = useMemo(() => challengeHtml(TURNSTILE_SITE_KEY), []);
  const source = useMemo(() => ({ html, baseUrl: API_URL }), [html]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as { token?: string | null };
        onToken(typeof data.token === 'string' && data.token.length > 0 ? data.token : null);
      } catch {
        onToken(null);
      }
    },
    [onToken],
  );

  if (!captchaRequired) return null;

  return (
    <View style={styles.box}>
      <WebView
        key={resetKey}
        originWhitelist={['*']}
        source={source}
        onMessage={handleMessage}
        scrollEnabled={false}
        style={styles.webview}
        containerStyle={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 84, alignItems: 'center', justifyContent: 'center' },
  webview: { backgroundColor: 'transparent', width: '100%', height: 84 },
});
