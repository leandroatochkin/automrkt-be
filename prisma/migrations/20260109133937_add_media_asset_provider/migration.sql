/*
  Warnings:

  - Changed the type of `provider` on the `MediaAsset` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MediaProvider" AS ENUM ('GEMINI', 'PUTER', 'OPENAI', 'LOCAL');

-- AlterTable
ALTER TABLE "MediaAsset" DROP COLUMN "provider",
ADD COLUMN     "provider" "MediaProvider" NOT NULL;
