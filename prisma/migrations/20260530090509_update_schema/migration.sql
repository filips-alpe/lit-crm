/*
  Warnings:

  - You are about to drop the column `alternateIds` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `bookNote` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `footNote` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `placeFrom` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `placeTo` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `priceNote` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `projectNote` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `remindToId` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `totalPrice` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `typeNote` on the `lit_record` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `lit_record` table. All the data in the column will be lost.
  - You are about to alter the column `sum` on the `lit_record` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.

*/
-- DropForeignKey
ALTER TABLE "lit_record" DROP CONSTRAINT "lit_record_projectId_fkey";

-- DropForeignKey
ALTER TABLE "lit_record" DROP CONSTRAINT "lit_record_remindToId_fkey";

-- DropForeignKey
ALTER TABLE "lit_record" DROP CONSTRAINT "lit_record_userId_fkey";

-- AlterTable
ALTER TABLE "lit_project" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "lit_record" DROP COLUMN "alternateIds",
DROP COLUMN "bookNote",
DROP COLUMN "endDate",
DROP COLUMN "footNote",
DROP COLUMN "placeFrom",
DROP COLUMN "placeTo",
DROP COLUMN "priceNote",
DROP COLUMN "projectId",
DROP COLUMN "projectNote",
DROP COLUMN "remindToId",
DROP COLUMN "startDate",
DROP COLUMN "totalPrice",
DROP COLUMN "typeNote",
DROP COLUMN "userId",
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "end" TIMESTAMPTZ(3),
ADD COLUMN     "from" TEXT,
ADD COLUMN     "recordId" TEXT,
ADD COLUMN     "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "start" TIMESTAMPTZ(3),
ADD COLUMN     "text" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "to" TEXT,
ADD COLUMN     "total" DECIMAL(12,2),
ADD COLUMN     "unit" TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "date" DROP NOT NULL,
ALTER COLUMN "date" DROP DEFAULT,
ALTER COLUMN "date" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "sum" DROP NOT NULL,
ALTER COLUMN "sum" DROP DEFAULT,
ALTER COLUMN "sum" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "hours" DROP NOT NULL,
ALTER COLUMN "hours" DROP DEFAULT,
ALTER COLUMN "allDay" DROP NOT NULL,
ALTER COLUMN "allDay" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lit_type" ADD COLUMN     "iconSeed" TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "lit_user" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "lit_project_record" (
    "projectId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,

    CONSTRAINT "lit_project_record_pkey" PRIMARY KEY ("projectId","recordId")
);

-- AddForeignKey
ALTER TABLE "lit_record" ADD CONSTRAINT "lit_record_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "lit_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_record" ADD CONSTRAINT "lit_record_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "lit_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_record" ADD CONSTRAINT "lit_record_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "lit_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_project_record" ADD CONSTRAINT "lit_project_record_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "lit_project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_project_record" ADD CONSTRAINT "lit_project_record_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "lit_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
