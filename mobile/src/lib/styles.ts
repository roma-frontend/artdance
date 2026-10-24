import { API_URL } from './config';
import type { ClassCard, InstructorCard, MediaRef, StudioCard } from './catalog';

/** Направление в перечне `/styles`. `image` — `null`, пока кадра нет. */
export type StyleSummary = {
  style: string;
  slug: string;
  image: MediaRef | null;
  classCount: number;
  instructorCount: number;
};

/** Хаб направления: занятия, преподаватели, залы и соседние направления. */
export type StyleHub = StyleSummary & {
  classes: ClassCard[];
  instructors: InstructorCard[];
  venues: StudioCard[];
  priceFrom: number | null;
  levels: string[];
  districts: string[];
  related: StyleSummary[];
};

export class StylesError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}/api/content/styles${path}`);
  if (!response.ok) throw new StylesError(response.status);
  return (await response.json()) as T;
}

export async function listStyles(): Promise<StyleSummary[]> {
  return (await getJson<{ styles: StyleSummary[] }>('')).styles;
}

export function getStyleHub(slug: string): Promise<StyleHub> {
  return getJson<StyleHub>(`/${encodeURIComponent(slug)}`);
}
