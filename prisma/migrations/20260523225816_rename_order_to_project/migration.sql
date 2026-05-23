-- Rename enum
ALTER TYPE "OrderStatus" RENAME TO "ProjectStatus";

-- Rename table
ALTER TABLE "lit_order" RENAME TO "lit_project";

-- Rename PK constraint
ALTER TABLE "lit_project" RENAME CONSTRAINT "lit_order_pkey" TO "lit_project_pkey";

-- Rename FKs on lit_project
ALTER TABLE "lit_project" RENAME CONSTRAINT "lit_order_creatorId_fkey" TO "lit_project_creatorId_fkey";
ALTER TABLE "lit_project" RENAME CONSTRAINT "lit_order_assigneeId_fkey" TO "lit_project_assigneeId_fkey";

-- Rename unique index on code
ALTER INDEX "lit_order_code_key" RENAME TO "lit_project_code_key";

-- Rename columns on lit_record
ALTER TABLE "lit_record" RENAME COLUMN "orderId" TO "projectId";
ALTER TABLE "lit_record" RENAME COLUMN "orderNote" TO "projectNote";

-- Rename FK on lit_record
ALTER TABLE "lit_record" RENAME CONSTRAINT "lit_record_orderId_fkey" TO "lit_record_projectId_fkey";
