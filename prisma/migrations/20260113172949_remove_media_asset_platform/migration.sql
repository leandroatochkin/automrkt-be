/*
  Warnings:

  - The values [LOCAL] on the enum `MediaProvider` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `platform` on the `MediaAsset` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MediaProvider_new" AS ENUM ('GEMINI', 'PUTER', 'OPENAI', 'USER');
ALTER TABLE "MediaAsset" ALTER COLUMN "provider" TYPE "MediaProvider_new" USING ("provider"::text::"MediaProvider_new");
ALTER TYPE "MediaProvider" RENAME TO "MediaProvider_old";
ALTER TYPE "MediaProvider_new" RENAME TO "MediaProvider";
DROP TYPE "MediaProvider_old";
COMMIT;

-- AlterTable
ALTER TABLE "MediaAsset" DROP COLUMN "platform";
