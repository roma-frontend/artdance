import { Platform, type TextStyle } from 'react-native';
import type { WithSpringConfig } from 'react-native-reanimated';

/** Палитра бренда для тёмной «кинематографичной» темы (docs/02-brand-system.md). */
export const colors = {
  bg: '#0B0809',
  surface: '#141012',
  surface2: '#1C1618',
  elevated: '#251C1F',
  line: 'rgba(245,241,234,0.08)',
  lineStrong: 'rgba(245,241,234,0.16)',
  text: '#F5F1EA',
  text2: '#BFB6AA',
  text3: '#857A70',
  accent: '#8B1A2B',
  accentBright: '#C93B52',
  accentSoft: 'rgba(201,59,82,0.16)',
  metal: '#C9A96A',
  success: '#3FB984',
  danger: '#FF6B7A',
  scrim: 'rgba(11,8,9,0.72)',
  white: '#FFFFFF',
} as const;

export const gradients = {
  accent: ['#B42A41', '#7A1626'] as const,
  heroShade: ['rgba(11,8,9,0)', 'rgba(11,8,9,0.55)', 'rgba(11,8,9,0.96)'] as const,
  ring: ['#E2B66E', '#C93B52', '#7A1626'] as const,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Playfair Display — заголовки бренда; основной текст — системный шрифт (SF / Roboto). */
export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  displayItalic: 'PlayfairDisplay_700Bold_Italic',
  displayMedium: 'PlayfairDisplay_600SemiBold',
} as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 38, lineHeight: 44, color: colors.text, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.text, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.text },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, lineHeight: 23, color: colors.text2 },
  bodySm: { fontSize: 13, lineHeight: 18, color: colors.text2 },
  caption: { fontSize: 12, lineHeight: 16, color: colors.text3 },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: colors.metal },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  button: { fontSize: 16, fontWeight: '700', color: colors.white, letterSpacing: 0.2 },
} satisfies Record<string, TextStyle>;

export const springs = {
  press: { damping: 15, stiffness: 320, mass: 0.6 },
  snappy: { damping: 18, stiffness: 240 },
  gentle: { damping: 20, stiffness: 140 },
} satisfies Record<string, WithSpringConfig>;

export const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 10 },
  default: {},
});

export const accentGlow = Platform.select({
  ios: { shadowColor: colors.accentBright, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 8 },
  default: {},
});
