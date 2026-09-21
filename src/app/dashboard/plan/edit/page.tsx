import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LogoFull } from "@/components/ui/Logo";
import Link from "next/link";
import { EditPlanForm } from "@/components/dashboard/EditPlanForm";
import { getSessionUserId } from "@/lib/session";

export default async function EditPlanPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: { event: true },
        take: 1,
      },
    },
  });

  if (!athlete) redirect("/onboarding");

  const activePlan = athlete.trainingPlans[0];

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <LogoFull size={30} href="/dashboard" />
          <Link href="/dashboard/plan" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Plano</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Preferências de treino</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Muda os dias no plano que tens, ou gera um plano novo com estas preferências
          </p>
        </div>

        <EditPlanForm
          initialDays={athlete.trainingDaysPerWeek ?? 5}
          initialLongRunDay={athlete.longRunDay ?? 7}
          initialWeeklyHours={athlete.weeklyHours ?? 8}
          initialFitnessLevel={athlete.fitnessLevel ?? "INTERMEDIATE"}
          initialPreferredDays={athlete.preferredDays ?? []}
          eventId={activePlan?.event.id ?? ""}
          eventName={activePlan?.event.name ?? ""}
          hasPlan={!!activePlan}
        />
      </main>
    </div>
  );
}
