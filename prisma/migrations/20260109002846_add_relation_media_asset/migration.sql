/*
  Warnings:

  - A unique constraint covering the columns `[jobId]` on the table `MediaAsset` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `jobId` to the `MediaAsset` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "jobId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_jobId_key" ON "MediaAsset"("jobId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MediaJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
