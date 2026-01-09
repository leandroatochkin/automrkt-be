-- AlterTable
ALTER TABLE "MediaJob" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "lastAttempt" TIMESTAMP(3);
