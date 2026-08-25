-- A slot can accumulate multiple booking attempts over its lifetime (e.g. a
-- declined request followed by a later successful one). Only `is_booked` on
-- coach_availability determines current availability, so `slot_id` must not
-- be unique on coach_bookings — a unique constraint here blocked rebooking
-- any slot that had already been declined once.
DROP INDEX "coach_bookings_slot_id_key";

CREATE INDEX "coach_bookings_slot_id_idx" ON "coach_bookings"("slot_id");
