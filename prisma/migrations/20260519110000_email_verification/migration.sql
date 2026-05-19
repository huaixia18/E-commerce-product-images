-- CreateEnum
CREATE TYPE "EmailVerificationPurpose" AS ENUM ('REGISTER', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "EmailVerification" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" "EmailVerificationPurpose" NOT NULL DEFAULT 'REGISTER',
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailVerification_email_createdAt_idx" ON "EmailVerification"("email", "createdAt");
CREATE INDEX "EmailVerification_expiresAt_idx" ON "EmailVerification"("expiresAt");
