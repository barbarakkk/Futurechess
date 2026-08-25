-- AlterTable
ALTER TABLE "coaches"
  ADD COLUMN     "hourly_rate_currency" TEXT,
  ADD COLUMN     "whatsapp_link" TEXT,
  ADD COLUMN     "telegram_link" TEXT;

-- AlterTable
ALTER TABLE "coach_applications"
  ADD COLUMN     "hourly_rate_currency" TEXT,
  ADD COLUMN     "whatsapp_link" TEXT,
  ADD COLUMN     "telegram_link" TEXT;
