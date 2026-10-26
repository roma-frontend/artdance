import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

/**
 * Онлайн-курсы. Сервер отвечает только при включённом тумблере `courses`
 * (иначе 404 `FEATURE_DISABLED`). Ключи видео в ответ не попадают.
 */

export type CourseCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  style: string;
  level: string;
  price: number;
  totalMinutes: number;
  lessonsCount: number;
  instructor: { slug: string; name: string };
};

export type CourseLesson = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  isPreview: boolean;
};

export type CourseDetail = CourseCard & {
  requirements: string[];
  lessons: CourseLesson[];
  enrolled: boolean;
};

export type CourseList = {
  items: CourseCard[];
  total: number;
  page: number;
  pageCount: number;
};

export type EnrollmentOrder = {
  id: string;
  orderNumber: string;
  total: number;
};

export class CoursesError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

async function failureFor(response: Response): Promise<CoursesError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new CoursesError(`HTTP ${response.status}`, response.status, serverMessage);
}

/** Каталог курсов на языке приложения. */
export async function listCourses(locale: string, page = 1): Promise<CourseList> {
  const params = new URLSearchParams({ locale, page: String(page), pageSize: '24' });
  const response = await fetch(`${API_URL}/api/courses?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as CourseList;
}

/** Карточка курса с программой. `enrolled` true, если текущий клиент уже записан. */
export async function getCourse(slug: string, locale: string): Promise<CourseDetail> {
  const token = await getSessionToken();
  const response = await fetch(`${API_URL}/api/courses/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { course: CourseDetail };
  return body.course;
}

/** Создаёт заказ на запись. Запись появится только после оплаты, которую подтверждает сервер. */
export async function enrollInCourse(slug: string): Promise<EnrollmentOrder> {
  const token = await getSessionToken();
  if (!token) throw new CoursesError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/courses/${encodeURIComponent(slug)}/enroll`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { order: EnrollmentOrder };
  return body.order;
}
