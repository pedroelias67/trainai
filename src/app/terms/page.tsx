import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <LogoFull size={28} />
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Termos de Serviço</h1>
        <p className="text-[var(--text-muted)] text-sm mb-10">Última atualização: Agosto de 2026</p>

        <div className="space-y-10 text-[var(--text-secondary)] leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Aceitação dos termos</h2>
            <p className="text-sm">
              Ao criares uma conta no TrainAI, aceitas estes Termos de Serviço e a nossa{" "}
              <Link href="/privacy" className="text-green-400 hover:text-green-300">Política de Privacidade</Link>.
              Se não concordares, não deves utilizar o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Descrição do serviço</h2>
            <p className="text-sm">
              O TrainAI é uma plataforma digital de treino personalizado que utiliza inteligência artificial
              para gerar e adaptar planos de treino para corredores e triatletas. O serviço é fornecido
              "tal como está" e pode ser alterado ou descontinuado a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Aviso médico</h2>
            <div className="p-4 rounded-xl bg-yellow-500/8 border border-yellow-500/20">
              <p className="text-yellow-400 font-medium text-sm mb-2">⚠️ Importante</p>
              <p className="text-sm">
                Os planos de treino gerados pelo TrainAI têm fins informativos e desportivos. Não substituem
                aconselhamento médico profissional. Consulta um médico antes de iniciar qualquer programa
                de exercício, especialmente se tiveres condições de saúde preexistentes. O TrainAI não se
                responsabiliza por lesões ou problemas de saúde resultantes do uso dos planos gerados.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Registo e conta</h2>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li>Deves ter pelo menos 16 anos para criar uma conta</li>
              <li>Deves fornecer informações verdadeiras e atualizadas</li>
              <li>És responsável por manter a confidencialidade da tua palavra-passe</li>
              <li>Uma conta por pessoa — contas partilhadas não são permitidas</li>
              <li>Reservamo-nos o direito de suspender contas que violem estes termos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Utilização aceitável</h2>
            <p className="text-sm mb-3">Ao usar o TrainAI, comprometest-te a não:</p>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li>Usar o serviço para fins ilegais ou não autorizados</li>
              <li>Tentar aceder a dados de outros utilizadores</li>
              <li>Sobrecarregar ou interferir com os servidores do serviço</li>
              <li>Fazer engenharia reversa ou copiar o software</li>
              <li>Partilhar o acesso à tua conta com terceiros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Integrações de terceiros</h2>
            <p className="text-sm">
              O TrainAI integra-se com o Strava e o Garmin Connect (exportação TCX). Estas integrações
              estão sujeitas aos termos de serviço dessas plataformas. Não somos responsáveis por
              alterações ou indisponibilidade dessas APIs de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Propriedade intelectual</h2>
            <p className="text-sm">
              O TrainAI e todo o seu conteúdo (logótipo, interface, código) são propriedade do seu criador.
              Os planos de treino gerados para ti são de teu uso pessoal e não podem ser redistribuídos
              comercialmente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Limitação de responsabilidade</h2>
            <p className="text-sm">
              Na medida máxima permitida pela lei, o TrainAI não é responsável por danos indiretos,
              incidentais ou consequenciais resultantes do uso ou impossibilidade de uso do serviço.
              A responsabilidade total não excede o valor pago pelo serviço nos últimos 12 meses.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Cancelamento e eliminação</h2>
            <p className="text-sm">
              Podes cancelar e eliminar a tua conta a qualquer momento a partir do teu{" "}
              <Link href="/dashboard/profile" className="text-green-400 hover:text-green-300">Perfil</Link>.
              Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos, com
              aviso prévio sempre que possível.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Lei aplicável</h2>
            <p className="text-sm">
              Estes termos são regidos pela lei portuguesa. Qualquer litígio será resolvido nos
              tribunais competentes de Portugal. Para utilizadores na União Europeia, aplicam-se
              também os direitos previstos no RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contacto</h2>
            <p className="text-sm">
              Para questões relacionadas com estes termos, contacta-nos em{" "}
              <a href="mailto:pedro@trainai.pedroelias.com" className="text-green-400 hover:text-green-300">
                pedro@trainai.pedroelias.com
              </a>.
            </p>
          </section>

          <div className="pt-4 border-t border-[var(--border)]">
            <div className="flex gap-4 text-xs text-[var(--text-faint)]">
              <Link href="/privacy" className="hover:text-[var(--text-muted)] transition-colors">Política de Privacidade</Link>
              <Link href="/dashboard" className="hover:text-[var(--text-muted)] transition-colors">Voltar à aplicação</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
