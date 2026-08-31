import { prisma } from "@/lib/prisma";

/**
 * Removes an athlete's data and the account itself, in one transaction.
 *
 * Order matters. Deleting the user alone and relying on cascades does not work:
 * TrainingPlan → Event and WeeklyReport → TrainingWeek are required relations,
 * which Prisma leaves as Restrict, so the cascade hits them and the whole delete
 * fails on a foreign key. Reports go before weeks, and plans before events, for
 * exactly that reason.
 *
 * Shared by the athlete's own "delete my account" and the admin panel, which
 * previously deleted the user directly and would have failed on any account
 * holding a plan.
 */
export async function deleteAccountData(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.personalRecord.deleteMany({ where: { athlete: { userId } } }),
    prisma.shoe.deleteMany({ where: { athlete: { userId } } }),
    prisma.weeklyReport.deleteMany({ where: { athlete: { userId } } }),
    prisma.activity.deleteMany({ where: { athlete: { userId } } }),
    prisma.trainingSession.deleteMany({ where: { week: { plan: { athlete: { userId } } } } }),
    prisma.trainingWeek.deleteMany({ where: { plan: { athlete: { userId } } } }),
    prisma.trainingPlan.deleteMany({ where: { athlete: { userId } } }),
    prisma.nutritionPlan.deleteMany({ where: { athlete: { userId } } }),
    prisma.wellnessLog.deleteMany({ where: { athlete: { userId } } }),
    prisma.event.deleteMany({ where: { athlete: { userId } } }),
    prisma.athlete.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
