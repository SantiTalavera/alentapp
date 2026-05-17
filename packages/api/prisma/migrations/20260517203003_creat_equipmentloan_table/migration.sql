-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('Prestado', 'Devuelto', 'Dañado');

-- CreateTable
CREATE TABLE "equipment_loans" (
    "id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'Prestado',
    "loan_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "member_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "equipment_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_loans_member_id_idx" ON "equipment_loans"("member_id");

-- AddForeignKey
ALTER TABLE "equipment_loans" ADD CONSTRAINT "equipment_loans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
