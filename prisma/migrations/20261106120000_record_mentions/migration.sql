-- CreateTable
CREATE TABLE "lit_record_mention" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,

    CONSTRAINT "lit_record_mention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lit_record_mention_sourceId_idx" ON "lit_record_mention"("sourceId");

-- CreateIndex
CREATE INDEX "lit_record_mention_entityId_idx" ON "lit_record_mention"("entityId");

-- AddForeignKey
ALTER TABLE "lit_record_mention" ADD CONSTRAINT "lit_record_mention_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "lit_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_record_mention" ADD CONSTRAINT "lit_record_mention_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "lit_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

