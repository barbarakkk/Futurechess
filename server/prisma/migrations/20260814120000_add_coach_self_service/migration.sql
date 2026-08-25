-- AlterTable
ALTER TABLE "coach_bookings" ADD COLUMN     "note" VARCHAR(500);

-- AlterTable
ALTER TABLE "coaches" ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'player';

-- CreateTable
CREATE TABLE "coach_applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "experience_years" INTEGER NOT NULL,
    "bio" TEXT,
    "photo_url" TEXT,
    "fide_rating" INTEGER,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hourly_rate" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "response_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "coach_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_weekly_rules" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "slot_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coach_weekly_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coach_applications_response_token_key" ON "coach_applications"("response_token");

-- CreateIndex
CREATE INDEX "coach_applications_user_id_idx" ON "coach_applications"("user_id");

-- CreateIndex
CREATE INDEX "coach_weekly_rules_coach_id_idx" ON "coach_weekly_rules"("coach_id");

-- CreateIndex
CREATE UNIQUE INDEX "coaches_user_id_key" ON "coaches"("user_id");

-- AddForeignKey
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_applications" ADD CONSTRAINT "coach_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_weekly_rules" ADD CONSTRAINT "coach_weekly_rules_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

