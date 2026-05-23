-- AlterTable: add the new alternateIds column
ALTER TABLE "lit_record" ADD COLUMN "alternateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: move existing idNote values into alternateIds as a one-element array
UPDATE "lit_record"
SET "alternateIds" = ARRAY["idNote"]
WHERE "idNote" IS NOT NULL AND "idNote" <> '';

-- Drop the old idNote column
ALTER TABLE "lit_record" DROP COLUMN "idNote";
