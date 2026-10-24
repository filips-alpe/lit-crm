/*
  Warnings:

  - You are about to drop the column `formCompiled` on the `lit_type` table. All the data in the column will be lost.
  - You are about to drop the column `formPrompt` on the `lit_type` table. All the data in the column will be lost.
  - You are about to drop the column `formSource` on the `lit_type` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "lit_type" DROP COLUMN "formCompiled",
DROP COLUMN "formPrompt",
DROP COLUMN "formSource";
