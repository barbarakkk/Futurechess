-- AlterTable
ALTER TABLE "coaches"
  ADD COLUMN     "fide_id" TEXT,
  ADD COLUMN     "phone" TEXT,
  ADD COLUMN     "whatsapp" TEXT,
  ADD COLUMN     "telegram" TEXT;

-- AlterTable
ALTER TABLE "coach_applications"
  ADD COLUMN     "fide_id" TEXT,
  ADD COLUMN     "phone" TEXT,
  ADD COLUMN     "whatsapp" TEXT,
  ADD COLUMN     "telegram" TEXT;
