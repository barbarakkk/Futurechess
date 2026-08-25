-- CreateTable
CREATE TABLE "coaches" (
    "id" TEXT NOT NULL,
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
    "email" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_availability" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "is_booked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "coach_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_bookings" (
    "id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "response_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_availability_coach_id_idx" ON "coach_availability"("coach_id");

-- CreateIndex
CREATE INDEX "coach_availability_start_time_idx" ON "coach_availability"("start_time");

-- CreateIndex
CREATE UNIQUE INDEX "coach_bookings_slot_id_key" ON "coach_bookings"("slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "coach_bookings_response_token_key" ON "coach_bookings"("response_token");

-- CreateIndex
CREATE INDEX "coach_bookings_user_id_idx" ON "coach_bookings"("user_id");

-- CreateIndex
CREATE INDEX "coach_bookings_coach_id_idx" ON "coach_bookings"("coach_id");

-- AddForeignKey
ALTER TABLE "coach_availability" ADD CONSTRAINT "coach_availability_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_bookings" ADD CONSTRAINT "coach_bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "coach_availability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_bookings" ADD CONSTRAINT "coach_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_bookings" ADD CONSTRAINT "coach_bookings_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Harden new tables the same way as the rest of the schema: RLS on, PostgREST
-- roles denied, backend-only access via Prisma (see 20260421130500 / 20260421140000).
ALTER TABLE "public"."coaches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."coach_availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."coach_bookings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."coaches" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."coach_availability" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."coach_bookings" FROM anon, authenticated;

CREATE POLICY "block_direct_api_access"
  ON "public"."coaches"
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "block_direct_api_access"
  ON "public"."coach_availability"
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "block_direct_api_access"
  ON "public"."coach_bookings"
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
