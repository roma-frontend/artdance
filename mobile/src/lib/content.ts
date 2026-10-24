import { API_URL } from './config';

export type FaqEntry = { question: string; answer: string };
export type FaqGroup = { id: string; title: string; items: FaqEntry[] };

/** Группы FAQ с сервера; тексты уже на выбранном языке. */
export async function getFaq(locale: string): Promise<FaqGroup[]> {
  const response = await fetch(`${API_URL}/api/content/faq?locale=${encodeURIComponent(locale)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as { groups: FaqGroup[] };
  return body.groups;
}

export type HelpTopic = { id: string; title: string; body: string; cta: string; path: string; anchor?: string };
export type HelpContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  topics: HelpTopic[];
  stillStuck: { title: string; body: string; cta: string; path: string };
};

/** Справка с сервера: разделы и тексты на выбранном языке. */
export async function getHelp(locale: string): Promise<HelpContent> {
  const response = await fetch(`${API_URL}/api/content/help?locale=${encodeURIComponent(locale)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as HelpContent;
}

export type AboutValue = { id: string; title: string; body: string };
export type AboutContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  mission: { title: string; body: string };
  values: { title: string; items: AboutValue[] };
  story: { title: string; body: string };
  cta: { title: string; subtitle: string; primary: string; primaryPath: string; secondary: string; secondaryPath: string };
};

/** О проекте с сервера на выбранном языке. */
export async function getAbout(locale: string): Promise<AboutContent> {
  const response = await fetch(`${API_URL}/api/content/about?locale=${encodeURIComponent(locale)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as AboutContent;
}
