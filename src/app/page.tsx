import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-white overflow-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-black/40">
        <LogoFull size={32} />
        <div className="hidden md:flex items-center gap-6 text-sm text-[var(--text-secondary)]">
          <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
          <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="btn-ghost text-sm">Entrar</Link>
          <Link href="/auth/register" className="btn-primary text-sm">Começar grátis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 max-w-5xl mx-auto text-center relative">
        {/* Background glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 border border-green-500/20 bg-green-500/5 rounded-full px-4 py-1.5 text-sm text-green-400 mb-8">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          Planos gerados por IA · Sincronização automática
        </div>

        <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
          O teu treinador<br />
          de elite,<br />
          <span className="text-gradient">alimentado por IA</span>
        </h1>

        <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-10 leading-relaxed">
          Planos de treino periodizados para corrida e triatlo, adaptados semanalmente com base nos teus dados reais.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link href="/auth/register" className="btn-primary text-base px-8 py-3.5 rounded-2xl">
            Criar o meu plano →
          </Link>
          <Link href="#como-funciona" className="btn-secondary text-base px-8 py-3.5 rounded-2xl">
            Ver como funciona
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mt-16 pt-16 border-t border-white/5">
          {[
            { value: "80/20", label: "Distribuição de intensidade" },
            { value: "Jack Daniels", label: "Metodologia de referência" },
            { value: "Strava", label: "Sincronização automática" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-white font-semibold text-lg">{s.value}</p>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="py-24 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-green-400 text-sm font-medium uppercase tracking-widest mb-3">Processo</p>
          <h2 className="text-3xl md:text-4xl font-bold">Simples. Inteligente. Eficaz.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Define o objetivo",
              desc: "Indica o evento, a data e o teu perfil. A IA cria um plano periodizado completo — base, construção, pico e taper.",
              icon: "🎯",
            },
            {
              step: "02",
              title: "Conecta o Strava",
              desc: "Liga o Strava (que sincroniza com Garmin automaticamente). Os dados chegam em segundos após cada treino.",
              icon: "⚡",
            },
            {
              step: "03",
              title: "Plano que aprende",
              desc: "Cada semana a IA analisa os teus treinos, compara com o planeado e adapta o plano seguinte para maximizar a progressão.",
              icon: "🧠",
            },
          ].map((item) => (
            <div key={item.step} className="card relative group hover:border-green-500/20 transition-all duration-300">
              <div className="text-3xl mb-4">{item.icon}</div>
              <div className="text-green-400/40 text-xs font-mono font-bold mb-2">{item.step}</div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-24 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-green-400 text-sm font-medium uppercase tracking-widest mb-3">Funcionalidades</p>
          <h2 className="text-3xl md:text-4xl font-bold">Tudo o que precisas</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: "📊", title: "Planos periodizados", desc: "Base aeróbica, construção, pico e taper. Princípio 80/20 aplicado automaticamente." },
            { icon: "🗺️", title: "Mapa GPS de cada treino", desc: "Percurso detalhado com coloração por pace ou FC após cada atividade sincronizada." },
            { icon: "❤️", title: "Análise de FC e zonas", desc: "Distribuição de tempo por zona de frequência cardíaca em cada sessão." },
            { icon: "🤖", title: "Análise semanal IA", desc: "Relatório semanal automático com comparação planeado vs executado e ajustes propostos." },
            { icon: "📋", title: "Orientações de treino", desc: "Aquecimento, parte principal e arrefecimento detalhados para cada sessão." },
            { icon: "🏆", title: "Splits por km", desc: "Pace, FC e cadência kilómetro a kilómetro em cada atividade registada." },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 p-5 rounded-2xl border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card)] transition-all">
              <span className="text-2xl shrink-0">{f.icon}</span>
              <div>
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-[var(--text-muted)] text-xs leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
          <h2 className="text-3xl font-bold mb-4">Pronto para treinar melhor?</h2>
          <p className="text-[var(--text-secondary)] mb-8">Cria o teu primeiro plano em menos de 2 minutos.</p>
          <Link href="/auth/register" className="btn-primary text-base px-10 py-4 rounded-2xl inline-block">
            Começar agora — é grátis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <LogoFull size={28} />
          <p className="text-[var(--text-faint)] text-xs">© 2025 TrainAI · Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
}
