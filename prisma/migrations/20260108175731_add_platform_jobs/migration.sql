/*
  Warnings:

  - The `status` column on the `PublishJob` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[campaignId,platform]` on the table `PublishJob` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `platform` to the `PublishJob` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PublishPlatform" AS ENUM ('TWITTER', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED', 'FAILED_PERMANENT', 'CANCELED');

-- AlterTable
ALTER TABLE "PublishJob" ADD COLUMN     "platform" "PublishPlatform" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "JobStatus" NOT NULL DEFAULT 'QUEUED';

-- CreateIndex
CREATE UNIQUE INDEX "PublishJob_campaignId_platform_key" ON "PublishJob"("campaignId", "platform");
