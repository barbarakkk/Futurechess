-- Removes the weekly-recurring-schedule feature. A coach's availability is now purely a set
-- of explicit dates (coach_availability_exceptions) — see coachAvailabilityService.js.

-- DropForeignKey (implicit via DropTable, listed for clarity)
ALTER TABLE "coach_weekly_rules" DROP CONSTRAINT IF EXISTS "coach_weekly_rules_coach_id_fkey";

-- DropTable
DROP TABLE "coach_weekly_rules";

-- AlterTable: the wizard no longer submits a weekly pattern
ALTER TABLE "coach_applications" DROP COLUMN "weekly_schedule";

-- AlterTable: every exception row is a plain "available date" now
ALTER TABLE "coach_availability_exceptions" ALTER COLUMN "type" SET DEFAULT 'one_off';
