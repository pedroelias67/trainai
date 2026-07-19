import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Fetch all sessions grouped by week
  const weeks = await prisma.trainingWeek.findMany({
    include: {
      sessions: {
        where: { cancelled: false },
        orderBy: { date: "asc" },
      },
    },
  });

  let updated = 0;

  for (const week of weeks) {
    const sessionIds: string[] = [];

    // Rule 1: LONG and BRICK are always priority
    for (const s of week.sessions) {
      if (s.sessionType === "LONG" || s.sessionType === "BRICK") {
        sessionIds.push(s.id);
      }
    }

    // Rule 2: Main intensity session (TEMPO or INTERVALS) if not already 2 priority
    if (sessionIds.length < 2) {
      const intensitySessions = week.sessions.filter(
        (s) =>
          (s.sessionType === "TEMPO" || s.sessionType === "INTERVALS") &&
          !sessionIds.includes(s.id)
      );
      // Pick the longest/hardest one (by plannedDistance or plannedDuration)
      if (intensitySessions.length > 0) {
        const main = intensitySessions.sort(
          (a, b) => (b.plannedDistance ?? 0) - (a.plannedDistance ?? 0)
        )[0];
        sessionIds.push(main.id);
      }
    }

    // Rule 3: Max 2 priority per week
    const finalIds = sessionIds.slice(0, 2);

    if (finalIds.length > 0) {
      await prisma.trainingSession.updateMany({
        where: { id: { in: finalIds } },
        data: { isPriority: true },
      });
      updated += finalIds.length;
      console.log(`Week ${week.weekNumber}: marked ${finalIds.length} sessions as priority`);
    }
  }

  console.log(`\nDone — ${updated} sessions marked as priority.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
