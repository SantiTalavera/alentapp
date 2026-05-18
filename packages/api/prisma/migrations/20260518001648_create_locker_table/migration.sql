-- CreateEnum
CREATE TYPE "LockerStatus" AS ENUM ('Available', 'Occupied', 'Maintenance');

-- CreateTable
CREATE TABLE "lockers" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "status" "LockerStatus" NOT NULL DEFAULT 'Available',
    "member_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lockers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lockers_number_key" ON "lockers"("number");
