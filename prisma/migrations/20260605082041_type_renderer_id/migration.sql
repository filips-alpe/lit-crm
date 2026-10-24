/*
  Warnings:

  - You are about to drop the column `cardCompiled` on the `lit_type` table. All the data in the column will be lost.
  - You are about to drop the column `cardPrompt` on the `lit_type` table. All the data in the column will be lost.
  - You are about to drop the column `cardSource` on the `lit_type` table. All the data in the column will be lost.
  - You are about to drop the column `rendererSvelteVersion` on the `lit_type` table. All the data in the column will be lost.
  - You are about to drop the column `rowCompiled` on the `lit_type` table. All the data in the column will be lost.
  - You are about to drop the column `rowPrompt` on the `lit_type` table. All the data in the column will be lost.
  - You are about to drop the column `rowSource` on the `lit_type` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "lit_type" DROP COLUMN "cardCompiled",
DROP COLUMN "cardPrompt",
DROP COLUMN "cardSource",
DROP COLUMN "rendererSvelteVersion",
DROP COLUMN "rowCompiled",
DROP COLUMN "rowPrompt",
DROP COLUMN "rowSource",
ADD COLUMN     "rendererId" TEXT;
