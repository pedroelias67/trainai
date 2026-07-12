import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8"><LogoFull size={36} className="justify-center" /></div>
        <div className="card space-y-4">
          <div className="text-4xl">📧</div>
          <h1 className="text-xl font-bold text-white">Confirma o teu email</h1>
          <p className="text-zinc-400 text-sm">
            Enviámos um link de confirmação para<br />
            <span className="text-white font-medium">{email ?? "o teu email"}</span>
          </p>
          <p className="text-zinc-600 text-xs">
            Verifica também a pasta de spam. O link expira em 24 horas.
          </p>
          <div className="pt-2 border-t border-[#1f1f1f]">
            <Link href="/auth/login" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              Já confirmei → Ir para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
