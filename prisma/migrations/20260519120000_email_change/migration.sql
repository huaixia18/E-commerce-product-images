-- AlterEnum
-- PG 12+ allows ALTER TYPE ADD VALUE inside a transaction as long as the
-- new value isn't *used* in the same transaction. Prisma migrate wraps
-- each migration file in a single transaction; this file only adds the
-- value, so it's safe. If we ever need to back-port to PG 11 or earlier,
-- this migration must be marked `-- prisma:atomic = false`.
ALTER TYPE "EmailVerificationPurpose" ADD VALUE 'EMAIL_CHANGE';
