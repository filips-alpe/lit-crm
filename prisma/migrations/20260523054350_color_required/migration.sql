/*
  Warnings:

  - Made the column `color` on table `lit_order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `lit_type` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `lit_user` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill nulls with a neutral gray (matches prior UI fallback) before tightening the constraint
UPDATE "lit_user"  SET "color" = '#000000' WHERE "color" IS NULL;
UPDATE "lit_type"  SET "color" = '#000000' WHERE "color" IS NULL;
UPDATE "lit_order" SET "color" = '#000000' WHERE "color" IS NULL;

-- AlterTable
ALTER TABLE "lit_order" ALTER COLUMN "color" SET NOT NULL;

-- AlterTable
ALTER TABLE "lit_type" ALTER COLUMN "color" SET NOT NULL;

-- AlterTable
ALTER TABLE "lit_user" ALTER COLUMN "color" SET NOT NULL;
