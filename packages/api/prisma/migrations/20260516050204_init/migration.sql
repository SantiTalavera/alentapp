-- CreateTable
CREATE TABLE "sports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "max_capacity" INTEGER NOT NULL,
    "additional_price" DOUBLE PRECISION NOT NULL,
    "requires_medical_certificate" BOOLEAN NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sports_name_key" ON "sports"("name");
