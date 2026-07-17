import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import NutritionPlanView from "@/components/dashboard/NutritionPlanView";
import NutritionQuestionnaire from "@/components/dashboard/NutritionQuestionnaire";

export default async function NutritionPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      nutritionPlans: { orderBy: { createdAt: "desc" }, take: 1 },
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: { event: true },
        take: 1,
      },
    },
  });
  if (!athlete) redirect("/onboarding");

  const hasBodyData = !!(athlete.weightKg && athlete.heightCm);
  const hasQuestionnaire = !!(athlete.activityLevel && athlete.dietStyle && athlete.trainingTimeOfDay);
  const existingPlan = athlete.nutritionPlans[0] ?? null;
  const activePlan = athlete.trainingPlans[0] ?? null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/dashboard/plan", label: "Plano" },
              { href: "/dashboard/nutrition", label: "Nutrição" },
              { href: "/dashboard/activities", label: "Atividades" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Plano Nutricional</h1>
            {activePlan ? (
              <p className="text-[var(--text-muted)] text-sm mt-1">
                Adaptado para {activePlan.event.name} · {new Date(activePlan.event.date).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            ) : (
              <p className="text-[var(--text-muted)] text-sm mt-1">Plano nutricional para atleta de endurance</p>
            )}
          </div>
          {hasQuestionnaire && existingPlan && (
            <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              Editar perfil nutricional
            </button>
          )}
        </div>

        {!hasBodyData && (
          <div className="card border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-[var(--text-primary)] font-medium text-sm">Dados em falta</p>
                <p className="text-[var(--text-secondary)] text-sm mt-1">
                  Para gerar o teu plano nutricional precisamos do teu peso e altura.
                </p>
                <Link href="/dashboard/profile/edit" className="btn-primary inline-block mt-3 text-sm py-2 px-4">
                  Preencher perfil →
                </Link>
              </div>
            </div>
          </div>
        )}

        {hasBodyData && !hasQuestionnaire && (
          <div className="space-y-4">
            <div className="flex gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/15 text-sm text-[var(--text-secondary)]">
              <span className="shrink-0 text-lg">🥗</span>
              <p>Responde a algumas perguntas rápidas para personalizar o teu plano nutricional. Só precisas de fazer isto uma vez.</p>
            </div>
            <NutritionQuestionnaire hasSport={!!activePlan} />
          </div>
        )}

        {hasBodyData && hasQuestionnaire && (
          <NutritionPlanView
            existingPlan={existingPlan ? { id: existingPlan.id, content: existingPlan.content, createdAt: existingPlan.createdAt.toISOString() } : null}
            eventName={activePlan?.event.name ?? null}
          />
        )}
      </main>
    </div>
  );
}
