import { File, Paths } from 'expo-file-system';

import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';

/** Те же 19 направлений, что и `danceStyles` на сервере. */
export const APPLICATION_STYLES = [
  'HIP_HOP',
  'BALLET',
  'SALSA',
  'BACHATA',
  'CONTEMPORARY',
  'HEELS',
  'KPOP',
  'LATIN',
  'TANGO',
  'ARMENIAN_FOLK',
  'JAZZ',
  'BREAKING',
  'FLAMENCO',
  'BALLROOM',
  'AFRO',
  'WEDDING_DANCE',
  'KIDS',
  'STRETCHING',
  'KIZOMBA',
] as const;

export type ApplicationDocumentKind = 'identity' | 'diploma' | 'certificate';

/** Лимит документа, как на сервере: 10 МБ и до 5 файлов. */
export const APPLICATION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const APPLICATION_DOCUMENT_MAX_COUNT = 5;

export type ApplicationDocumentDraft = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  kind: ApplicationDocumentKind;
};

export type InstructorApplicationDraft = {
  name: string;
  email: string;
  phone: string;
  bio: string;
  styles: string[];
  documents: ApplicationDocumentDraft[];
};

/** Текстовая часть черновика. Документы сюда не входят: их URI живут в кеше picker-а. */
export type SavedApplicationText = Omit<InstructorApplicationDraft, 'documents'> & { step: number };

export class InstructorApplicationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Отправка заявки. Публичный маршрут: bearer-токен не нужен, личность не определяется. */
export async function submitInstructorApplication(draft: InstructorApplicationDraft): Promise<{ id: string }> {
  const form = new FormData();
  form.append('name', draft.name.trim());
  form.append('email', draft.email.trim());
  form.append('phone', draft.phone.trim());
  form.append('bio', draft.bio.trim());
  draft.styles.forEach((style) => form.append('styles', style));

  draft.documents.forEach((document) => {
    // React Native принимает файл как объект с uri, а не как Blob.
    form.append('documents', {
      uri: document.uri,
      name: document.name,
      type: document.mimeType ?? 'application/octet-stream',
    } as unknown as Blob);
    form.append('documentKinds', document.kind);
  });

  const response = await fetch(`${API_URL}/api/instructor-applications`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });

  if (!response.ok) {
    const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
    throw new InstructorApplicationError(`HTTP ${response.status}`, response.status, serverMessage);
  }

  const body = (await response.json()) as { id: string };
  return { id: body.id };
}

const DRAFT_NAME = 'instructor-application-draft.json';

function draftFile(): File {
  return new File(Paths.document, DRAFT_NAME);
}

/** Сохраняет текст заявки, чтобы не потерять его при закрытии приложения. Ошибки записи не блокируют форму. */
export async function saveApplicationDraft(text: SavedApplicationText): Promise<void> {
  try {
    const file = draftFile();
    file.create({ overwrite: true });
    await file.write(JSON.stringify(text));
  } catch {
    /* черновик — удобство, а не обязательная часть отправки */
  }
}

/** Возвращает сохранённый черновик или `null`, если его нет или он повреждён. */
export async function loadApplicationDraft(): Promise<SavedApplicationText | null> {
  try {
    const file = draftFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(await file.text()) as SavedApplicationText;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearApplicationDraft(): Promise<void> {
  try {
    const file = draftFile();
    if (file.exists) file.delete();
  } catch {
    /* уже удалён */
  }
}
