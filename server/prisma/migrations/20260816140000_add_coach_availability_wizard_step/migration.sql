-- AlterTable
ALTER TABLE "coach_applications"
  ADD COLUMN     "weekly_schedule" JSONB,
  ADD COLUMN     "availability_exceptions" JSONB;

-- CreateTable
CREATE TABLE "coach_availability_exceptions" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "start_minute" INTEGER,
    "end_minute" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_availability_exceptions_coach_id_idx" ON "coach_availability_exceptions"("coach_id");

-- CreateIndex
CREATE UNIQUE INDEX "coach_availability_exceptions_coach_id_date_key" ON "coach_availability_exceptions"("coach_id", "date");

-- AddForeignKey
ALTER TABLE "coach_availability_exceptions" ADD CONSTRAINT "coach_availability_exceptions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
