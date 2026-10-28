-- Better Auth 1.7.3+ не записывает колонку "issuer": аккаунт ищется по паре
-- (providerId, accountId). NOT NULL и уникальный индекс по (issuer, accountId)
-- мешают вставке новых аккаунтов, поэтому снимаем оба ограничения. Колонка
-- остаётся (допускает NULL): удаление данных необратимо и выполняется отдельно.

-- DropIndex
DROP INDEX IF EXISTS "Account_issuer_accountId_key";

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "issuer" DROP NOT NULL;
