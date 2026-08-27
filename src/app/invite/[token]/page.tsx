import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LogoFull } from "@/components/ui/Logo";

const FEATURES = [
  { icon: "🤖", title: "Plano gerado por IA", desc: "Claude analisa o teu perfil e cria um plano de treino 100% personalizado para o teu evento." },
  { icon: "📊", title: "Adaptação automática", desc: "Cada semana a IA analisa o teu desempenho e ajusta o plano em tempo real." },
  { icon: "⌚", title: "Treinos no relógio", desc: "Envia os treinos da semana para Garmin, COROS, Suunto ou Wahoo através do Intervals.icu." },
  { icon: "🍎", title: "Nutrição personalizada", desc: "Plano de nutrição com calorias, macros e refeições adaptados ao teu treino." },
  { icon: "🔄", title: "Sincronização Strava", desc: "Liga o Strava e as atividades aparecem automaticamente, sem trabalho manual." },
  { icon: "📱", title: "App móvel (PWA)", desc: "Instala no telemóvel e usa offline, com notificações de treino e temporizador integrado." },
];

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({ where: { token } });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    notFound();
  }

  const inviter = invite.createdById
    ? await prisma.user.findUnique({ where: { id: invite.createdById }, select: { name: true } })
    : null;

  const registerUrl = `/auth/register?invite=${token}${invite.email ? `&email=${encodeURIComponent(invite.email)}` : ""}`;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <LogoFull size={28} />
          <Link href="/auth/login" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            Já tens conta? Entra
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm font-medium">
              {inviter?.name ? `${inviter.name} convidou-te` : "Convite exclusivo"}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            O teu treinador pessoal<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">com inteligência artificial</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg max-w-xl mx-auto mb-8">
            Planos de treino personalizados para corredores e triatletas, gerados e adaptados pela IA com base no teu desempenho real.
          </p>

          <Link
            href={registerUrl}
            className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold text-lg px-8 py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-green-500/20"
          >
            Aceitar convite e criar conta →
          </Link>
          {invite.email && (
            <p className="text-[var(--text-muted)] text-xs mt-3">Convite para {invite.email}</p>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-16">
          {[
            { value: "100%", label: "Personalizado" },
            { value: "IA", label: "Claude (Anthropic)" },
            { value: "PWA", label: "Funciona offline" },
          ].map((s) => (
            <div key={s.label} className="text-center p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
              <p className="text-2xl font-black text-green-400 mb-1">{s.value}</p>
              <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-xl font-bold text-white text-center mb-8">O que inclui o TrainAI</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-hover)] transition-all">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <p className="font-semibold text-white text-sm mb-1">{f.title}</p>
                  <p className="text-[var(--text-muted)] text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA final */}
        <div className="text-center p-8 rounded-2xl border border-green-500/20 bg-green-500/5">
          <p className="text-white font-bold text-lg mb-2">Pronto para começar?</p>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            Leva menos de 2 minutos a criar a conta e gerar o teu primeiro plano.
          </p>
          <Link
            href={registerUrl}
            className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3.5 rounded-xl transition-all active:scale-95"
          >
            Criar conta gratuita →
          </Link>
        </div>

        <p className="text-center text-[var(--text-faint)] text-xs mt-8">
          Ao criares conta, aceitas os{" "}
          <Link href="/terms" className="hover:text-[var(--text-muted)] underline underline-offset-2">Termos de Serviço</Link>
          {" "}e a{" "}
          <Link href="/privacy" className="hover:text-[var(--text-muted)] underline underline-offset-2">Política de Privacidade</Link>.
        </p>
      </main>
    </div>
  );
}
