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

export type GiftCardsPreset = { amount: number; label: string };
export type GiftCardsStep = { id: string; title: string; body: string };
export type GiftCardsTerm = { id: string; text: string };
export type GiftCardsContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  amounts: { title: string; note: string; presets: GiftCardsPreset[]; comingSoon: string; validity: string };
  steps: { title: string; items: GiftCardsStep[] };
  terms: { title: string; items: GiftCardsTerm[] };
  cta: { title: string; subtitle: string; primary: string; primaryPath: string; secondary: string; secondaryPath: string };
};

/** Подарочные карты с сервера. Сервер отвечает `FEATURE_DISABLED`, если модуль магазина выключен. */
export async function getGiftCards(locale: string): Promise<GiftCardsContent> {
  const response = await fetch(`${API_URL}/api/content/gift-cards?locale=${encodeURIComponent(locale)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as GiftCardsContent;
}

export type LegalStatus = 'draft' | 'active';
export type LegalDocumentSummary = { id: string; slug: string; path: string; title: string; version: string; status: LegalStatus };
export type LegalIndexContent = { title: string; documents: LegalDocumentSummary[] };
export type LegalSection = { id: string; title: string; body: string };
export type LegalDocumentContent = {
  id: string;
  slug: string;
  path: string;
  title: string;
  intro: string;
  status: LegalStatus;
  draftNotice: string | null;
  version: string;
  lastUpdated: string;
  versionNote: string;
  contactNote: string;
  tocTitle: string;
  documentsTitle: string;
  sections: LegalSection[];
  others: LegalDocumentSummary[];
};

/** Список правовых документов с сервера на выбранном языке. */
export async function getLegalIndex(locale: string): Promise<LegalIndexContent> {
  const response = await fetch(`${API_URL}/api/content/legal?locale=${encodeURIComponent(locale)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as LegalIndexContent;
}

/** Текст одного правового документа. Неизвестный слаг сервер отвечает 404. */
export async function getLegalDocument(locale: string, slug: string): Promise<LegalDocumentContent> {
  const response = await fetch(
    `${API_URL}/api/content/legal/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as LegalDocumentContent;
}

export type ContactTopicOption = { value: string; label: string };
export type ContactChannel = { id: string; title: string; note: string; value: string | null; href: string | null };
export type ContactContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  responseTime: string;
  channelsTitle: string;
  channels: ContactChannel[];
  form: {
    title: string;
    nameLabel: string;
    emailLabel: string;
    topicLabel: string;
    messageLabel: string;
    messagePlaceholder: string;
    submit: string;
    defaultTopic: string;
    topics: ContactTopicOption[];
  };
  outcome: { successTitle: string; successBody: string; failedTitle: string; failedBody: string };
  errors: { required: string; email: string };
  supportEmail: string;
  webPath: string;
};
export type ContactInput = { name: string; email: string; topic: string; message: string; locale: string };
export type ContactOutcome = { delivered: boolean };

export class ContactError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field: string | null,
  ) {
    super(message);
  }
}

/** Тексты формы обращения с сервера на выбранном языке. */
export async function getContact(locale: string): Promise<ContactContent> {
  const response = await fetch(`${API_URL}/api/content/contact?locale=${encodeURIComponent(locale)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ContactContent;
}

/** Отправка обращения. `delivered: false` — письмо не ушло: показать адрес поддержки. Ошибка несёт код и поле. */
export async function sendContact(input: ContactInput): Promise<ContactOutcome> {
  const response = await fetch(`${API_URL}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string; field?: string; delivered?: boolean };
  if (!response.ok) {
    throw new ContactError(body.error ?? `HTTP ${response.status}`, response.status, body.field ?? null);
  }
  return { delivered: body.delivered === true };
}
