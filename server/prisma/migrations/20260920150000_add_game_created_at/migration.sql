-- AlterTable
ALTER TABLE "games" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "games_status_created_at_idx" ON "games"("status", "created_at");
