import { apiRequest } from './api-client';

/** Сохранённые поиски: список и удаление. Создаёт их экран поиска. */

export type SavedSearch = {
  id: string;
  query: string;
  scope: string;
  createdAt: string;
};

export function listSavedSearches() {
  return apiRequest<{ items: SavedSearch[] }>('/api/saved-searches');
}

export function deleteSavedSearch(id: string) {
  return apiRequest(`/api/saved-searches/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
