-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('GRANTED', 'REVOKED');

-- AlterTable (referralCode already added in dev DB; idempotent for fresh installs)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
UPDATE "User" SET "referralCode" = id WHERE "referralCode" IS NULL;
ALTER TABLE "User" ALTER COLUMN "referralCode" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");

-- CreateTable
CREATE TABLE "Referral" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "inviteeId" TEXT NOT NULL,
  "status" "ReferralStatus" NOT NULL DEFAULT 'GRANTED',
  "referrerReward" INTEGER NOT NULL,
  "inviteeReward" INTEGER NOT NULL,
  "inviteeIp" TEXT,
  "inviteeFp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_inviteeId_key" ON "Referral"("inviteeId");
CREATE INDEX "Referral_referrerId_createdAt_idx" ON "Referral"("referrerId", "createdAt");

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
