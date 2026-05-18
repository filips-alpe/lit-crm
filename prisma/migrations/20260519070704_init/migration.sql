-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TypeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "lit_user" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "color" TEXT,

    CONSTRAINT "lit_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lit_type" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "TypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "code" TEXT NOT NULL,
    "description" TEXT,
    "layout" JSONB,
    "color" TEXT,

    CONSTRAINT "lit_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lit_record" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "footNote" TEXT,
    "idNote" TEXT,
    "orderNote" TEXT,
    "typeNote" TEXT,
    "priceNote" TEXT,
    "bookNote" TEXT,
    "placeFrom" TEXT,
    "placeTo" TEXT,
    "userId" TEXT,
    "orderId" TEXT,
    "typeId" TEXT NOT NULL,
    "remindToId" TEXT,

    CONSTRAINT "lit_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lit_order" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "code" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "creatorId" TEXT,
    "assigneeId" TEXT,

    CONSTRAINT "lit_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lit_user_username_key" ON "lit_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "lit_type_code_key" ON "lit_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lit_order_code_key" ON "lit_order"("code");

-- AddForeignKey
ALTER TABLE "lit_record" ADD CONSTRAINT "lit_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "lit_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_record" ADD CONSTRAINT "lit_record_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "lit_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_record" ADD CONSTRAINT "lit_record_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "lit_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_record" ADD CONSTRAINT "lit_record_remindToId_fkey" FOREIGN KEY ("remindToId") REFERENCES "lit_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_order" ADD CONSTRAINT "lit_order_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "lit_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lit_order" ADD CONSTRAINT "lit_order_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "lit_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
