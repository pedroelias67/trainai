import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LogoFull } from "@/components/ui/Logo";
import Link from "next/link";
import { EditPlanForm } from "@/components/dashboard/EditPlanForm";

export default async function EditPlanPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
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
          <LogoFull size={30} />
          <Link href="/dashboard/plan" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Plano</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Preferências de treino</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Ajusta as tuas preferências e regenera o plano com IA
          </p>
        </div>

        <EditPlanForm
          initialDays={athlete.trainingDaysPerWeek ?? 5}
          initialLongRunDay={athlete.longRunDay ?? 7}
          initialWeeklyHours={athlete.weeklyHours ?? 8}
          initialFitnessLevel={athlete.fitnessLevel ?? "INTERMEDIATE"}
          eventId={activePlan?.event.id ?? ""}
          eventName={activePlan?.event.name ?? ""}
          hasPlan={!!activePlan}
        />
      </main>
    </div>
  );
}
