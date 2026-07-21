-- Enable RLS on all tables
-- The app uses Prisma with the service_role key which bypasses RLS.
-- Enabling RLS with no public policies blocks all anon/public API access.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Athlete" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NutritionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingWeek" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shoe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonalRecord" ENABLE ROW LEVEL SECURITY;

-- Revoke all public API access (belt-and-suspenders on top of RLS)
REVOKE ALL ON "User" FROM anon, authenticated;
REVOKE ALL ON "Account" FROM anon, authenticated;
REVOKE ALL ON "Session" FROM anon, authenticated;
REVOKE ALL ON "Athlete" FROM anon, authenticated;
REVOKE ALL ON "NutritionPlan" FROM anon, authenticated;
REVOKE ALL ON "Event" FROM anon, authenticated;
REVOKE ALL ON "TrainingPlan" FROM anon, authenticated;
REVOKE ALL ON "TrainingWeek" FROM anon, authenticated;
REVOKE ALL ON "TrainingSession" FROM anon, authenticated;
REVOKE ALL ON "Activity" FROM anon, authenticated;
REVOKE ALL ON "WeeklyReport" FROM anon, authenticated;
REVOKE ALL ON "Invite" FROM anon, authenticated;
REVOKE ALL ON "Shoe" FROM anon, authenticated;
REVOKE ALL ON "PersonalRecord" FROM anon, authenticated;
