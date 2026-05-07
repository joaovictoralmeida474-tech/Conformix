-- AlterTable
ALTER TABLE "RNC" ADD COLUMN "cause" TEXT;
ALTER TABLE "RNC" ADD COLUMN "correctiveAction" TEXT;
ALTER TABLE "RNC" ADD COLUMN "responsible" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "reactivationJustification" TEXT;
