-- CreateTable
CREATE TABLE "lit_mention" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "surface" TEXT NOT NULL,

    CONSTRAINT "lit_mention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lit_mention_entityId_idx" ON "lit_mention"("entityId");

-- CreateIndex
CREATE INDEX "lit_mention_recordId_idx" ON "lit_mention"("recordId");

-- AddForeignKey
ALTER TABLE "lit_mention" ADD CONSTRAINT "lit_mention_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "lit_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_mention" ADD CONSTRAINT "lit_mention_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "lit_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
