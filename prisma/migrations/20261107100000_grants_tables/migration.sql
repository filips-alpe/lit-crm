-- CreateEnum
CREATE TYPE "GrantLevel" AS ENUM ('READ', 'WRITE');

-- AlterTable
ALTER TABLE "lit_record" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "lit_group" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "lit_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lit_group_member" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lit_group_member_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "lit_grant" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,
    "personId" TEXT,
    "projectId" TEXT,
    "typeId" TEXT,
    "recordId" TEXT,
    "level" "GrantLevel" NOT NULL DEFAULT 'READ',
    "hideAmounts" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lit_grant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lit_group_name_key" ON "lit_group"("name");

-- CreateIndex
CREATE INDEX "lit_group_member_userId_idx" ON "lit_group_member"("userId");

-- CreateIndex
CREATE INDEX "lit_grant_userId_idx" ON "lit_grant"("userId");

-- CreateIndex
CREATE INDEX "lit_grant_groupId_idx" ON "lit_grant"("groupId");

-- CreateIndex
CREATE INDEX "lit_grant_personId_idx" ON "lit_grant"("personId");

-- CreateIndex
CREATE INDEX "lit_grant_projectId_idx" ON "lit_grant"("projectId");

-- CreateIndex
CREATE INDEX "lit_grant_typeId_idx" ON "lit_grant"("typeId");

-- CreateIndex
CREATE INDEX "lit_grant_recordId_idx" ON "lit_grant"("recordId");

-- CreateIndex
CREATE INDEX "lit_project_creatorId_idx" ON "lit_project"("creatorId");

-- CreateIndex
CREATE INDEX "lit_project_assigneeId_idx" ON "lit_project"("assigneeId");

-- CreateIndex
CREATE INDEX "lit_project_record_recordId_idx" ON "lit_project_record"("recordId");

-- CreateIndex
CREATE INDEX "lit_record_creatorId_idx" ON "lit_record"("creatorId");

-- CreateIndex
CREATE INDEX "lit_record_assigneeId_idx" ON "lit_record"("assigneeId");

-- CreateIndex
CREATE INDEX "lit_record_typeId_idx" ON "lit_record"("typeId");

-- CreateIndex
CREATE INDEX "lit_record_recordId_idx" ON "lit_record"("recordId");

-- AddForeignKey
ALTER TABLE "lit_group_member" ADD CONSTRAINT "lit_group_member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "lit_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_group_member" ADD CONSTRAINT "lit_group_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "lit_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_grant" ADD CONSTRAINT "lit_grant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "lit_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_grant" ADD CONSTRAINT "lit_grant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "lit_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_grant" ADD CONSTRAINT "lit_grant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "lit_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_grant" ADD CONSTRAINT "lit_grant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "lit_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_grant" ADD CONSTRAINT "lit_grant_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "lit_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_grant" ADD CONSTRAINT "lit_grant_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "lit_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written, not modelled by Prisma (it ignores CHECK constraints, so no drift):
-- a grant has exactly one target and exactly one scope.
ALTER TABLE "lit_grant" ADD CONSTRAINT "lit_grant_one_target" CHECK (num_nonnulls("userId", "groupId") = 1);
ALTER TABLE "lit_grant" ADD CONSTRAINT "lit_grant_one_scope" CHECK (num_nonnulls("personId", "projectId", "typeId", "recordId") = 1);
