'use client';

/**
 * SESSION ROOM SELECT — выбор зала для занятия на площадке.
 *
 * Значение select зеркалит `roomId` с сервера. Если сохранение отклонено
 * (конфликт, чужой зал), значение возвращается к сохранённому, чтобы форма
 * не врала. Успешное сохранение обновляет страницу, и список перечитывается.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { MessageKey } from '@/i18n/types';
import { useRouter } from '@/i18n/routing';
import { assignSessionRoom, type VenueRoomActionState } from '@/server/actions/venue';

interface Props {
  sessionId: string;
  roomId: string | null;
  rooms: readonly { id: string; name: string }[];
  noRoomLabel: string;
  label: string;
}

export function SessionRoomSelect({ sessionId, roomId, rooms, noRoomLabel, label }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [value, setValue] = useState(roomId ?? '');
  const [feedback, setFeedback] = useState<VenueRoomActionState>({ status: 'idle' });

  const assign = useAction(assignSessionRoom, {
    onSuccess: (result) => {
      const data = result.data;
      if (!data) {
        setValue(roomId ?? '');
        setFeedback({ status: 'error', messageKey: 'footer.venueDashboardRoomError' as MessageKey });
        return;
      }
      setFeedback(data);
      if (data.status === 'success') router.refresh();
      else setValue(roomId ?? '');
    },
    onError: () => {
      setValue(roomId ?? '');
      setFeedback({ status: 'error', messageKey: 'footer.venueDashboardRoomError' as MessageKey });
    },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-caption text-content-secondary">
        <span>{label}</span>
        <select
          aria-label={label}
          value={value}
          disabled={assign.status === 'executing'}
          onChange={(event) => {
            const next = event.target.value;
            setValue(next);
            setFeedback({ status: 'idle' });
            assign.execute({ sessionId, roomId: next === '' ? null : next });
          }}
          className="form-input"
        >
          <option value="">{noRoomLabel}</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </label>
      {feedback.status !== 'idle' && feedback.messageKey && (
        <p
          role={feedback.status === 'error' ? 'alert' : 'status'}
          className={feedback.status === 'error' ? 'text-caption font-semibold text-content-danger' : 'text-caption text-content-tertiary'}
        >
          {t(feedback.messageKey as never)}
        </p>
      )}
    </div>
  );
}
