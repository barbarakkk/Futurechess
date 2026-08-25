-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reset_token_hash" TEXT,
ADD COLUMN     "reset_token_expiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_reset_token_hash_key" ON "users"("reset_token_hash");
