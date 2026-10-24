-- Исключения раньше хранили время бизнеса как UTC-метку (UTC+4 не учитывался).
-- Сдвиг на -4 часа переводит их в настоящие моменты времени. Выполняется один раз.
UPDATE "AvailabilityException"
SET "startsAt" = "startsAt" - INTERVAL '4 hours',
    "endsAt"   = "endsAt"   - INTERVAL '4 hours';
