-- AlterTable
ALTER TABLE "PublishJob" ADD COLUMN     "lastAttempt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;
