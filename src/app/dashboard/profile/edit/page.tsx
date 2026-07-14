import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LogoFull } from "@/components/ui/Logo";
import Link from "next/link";
import { EditProfileForm } from "@/components/dashboard/EditProfileForm";

export default async function EditProfilePage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!athlete) redirect("/onboarding");

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <Link href="/dashboard/profile" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Perfil</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Editar perfil</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Os dados de FC e pace melhoram a precisão dos planos gerados por IA</p>
        </div>

        <EditProfileForm
          initial={{
            name: athlete.user.name ?? "",
            dateOfBirth: athlete.dateOfBirth ? athlete.dateOfBirth.toISOString().split("T")[0] : "",
            gender: athlete.gender ?? "MALE",
            fitnessLevel: athlete.fitnessLevel ?? "INTERMEDIATE",
            weeklyHours: athlete.weeklyHours ?? 8,
            maxHR: athlete.maxHR ?? null,
            restingHR: athlete.restingHR ?? null,
            ltPace: athlete.ltPace ?? null,
            ftp: athlete.ftp ?? null,
          }}
        />
      </main>
    </div>
  );
}
