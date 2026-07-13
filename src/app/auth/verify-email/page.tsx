import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8"><LogoFull size={36} className="justify-center" /></div>
        <div className="card space-y-4">
          <div className="text-4xl">📧</div>
          <h1 className="text-xl font-bold text-white">Confirma o teu email</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            Enviámos um link de confirmação para<br />
            <span className="text-white font-medium">{email ?? "o teu email"}</span>
          </p>
          <p className="text-[var(--text-faint)] text-xs">
            Verifica também a pasta de spam. O link expira em 24 horas.
          </p>
          <div className="pt-2 border-t border-[var(--border)]">
            <Link href="/auth/login" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
              Já confirmei → Ir para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
