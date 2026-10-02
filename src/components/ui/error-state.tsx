/**
 * ERROR STATE — состояние ошибки списка/страницы.
 *
 * 08 §6: `errors.*` + кнопка повтора + код инцидента Sentry.
 * `role=alert` — assertive, в отличие от EmptyState (polite).
 */

import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title: string;
  description?: string;
  incidentId?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ title, description, incidentId, onRetry, retryLabel = 'Повторить' }: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-4 rounded-xl border border-danger/20 bg-danger-soft px-6 py-16 text-center"
    >
      <p className="text-card-title text-content-primary">{title}</p>
      {description !== undefined && <p className="text-body-sm max-w-(--layout-prose-max-width) text-content-secondary">{description}</p>}
      {incidentId !== undefined && <p className="text-caption font-mono text-content-tertiary">ID: {incidentId}</p>}
      {onRetry !== undefined && (
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
