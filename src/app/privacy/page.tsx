import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-white mb-2">Política de Privacidade</h1>
        <p className="text-[var(--text-muted)] text-sm mb-10">Última atualização: Agosto de 2026</p>

        <div className="space-y-10 text-[var(--text-secondary)] leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Quem somos</h2>
            <p>
              O TrainAI é uma plataforma de treino personalizado com inteligência artificial, desenvolvida
              e operada a título individual. Para questões de privacidade, podes contactar-nos através de{" "}
              <a href="mailto:pedroelias67@gmail.com" className="text-green-400 hover:text-green-300">
                pedroelias67@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Dados que recolhemos</h2>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                <p className="text-white font-medium text-sm mb-1">Dados da conta</p>
                <p className="text-xs">Nome, endereço de email e palavra-passe (armazenada de forma encriptada).</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                <p className="text-white font-medium text-sm mb-1">Dados de perfil desportivo</p>
                <p className="text-xs">Data de nascimento, género, nível de condição física, frequência cardíaca máxima e em repouso, horas semanais de treino disponíveis.</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                <p className="text-white font-medium text-sm mb-1">Dados de treino</p>
                <p className="text-xs">Sessões de treino planeadas e concluídas, atividades importadas do Strava, eventos desportivos, planos de nutrição gerados.</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                <p className="text-white font-medium text-sm mb-1">Dados de bem-estar</p>
                <p className="text-xs">Check-ins diários de qualidade de sono, energia, humor e stress (introduzidos voluntariamente).</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Como usamos os teus dados</h2>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li>Gerar e adaptar o teu plano de treino personalizado com IA</li>
              <li>Sincronizar atividades com o Strava (se autorizado)</li>
              <li>Enviar notificações push sobre os teus treinos (se autorizado)</li>
              <li>Calcular métricas de desempenho e evolução</li>
              <li>Melhorar o serviço com base em padrões agregados e anónimos</li>
            </ul>
            <p className="mt-3 text-sm">
              Nunca vendemos, partilhamos nem cedemos os teus dados pessoais a terceiros para fins
              publicitários ou comerciais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Cookies</h2>
            <p className="text-sm mb-3">
              Usamos apenas cookies estritamente necessários para o funcionamento da aplicação:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-[var(--border)] rounded-xl overflow-hidden">
                <thead className="bg-[var(--bg-subtle)]">
                  <tr>
                    <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">Cookie</th>
                    <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">Finalidade</th>
                    <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="px-4 py-3 text-[var(--text-primary)] font-mono">user_id</td>
                    <td className="px-4 py-3">Manter sessão autenticada</td>
                    <td className="px-4 py-3">30 dias</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-[var(--text-primary)] font-mono">trainai_theme</td>
                    <td className="px-4 py-3">Guardar preferência de tema</td>
                    <td className="px-4 py-3">1 ano</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm">
              Não utilizamos cookies de publicidade, rastreamento ou análise de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Os teus direitos (RGPD)</h2>
            <p className="text-sm mb-3">
              Ao abrigo do Regulamento Geral de Proteção de Dados (RGPD), tens os seguintes direitos:
            </p>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li><span className="text-white font-medium">Acesso</span> — podes solicitar uma cópia dos teus dados</li>
              <li><span className="text-white font-medium">Retificação</span> — podes corrigir dados incorretos no teu perfil</li>
              <li><span className="text-white font-medium">Eliminação</span> — podes eliminar a tua conta e todos os dados associados a qualquer momento</li>
              <li><span className="text-white font-medium">Portabilidade</span> — podes exportar os teus dados em formato TCX</li>
              <li><span className="text-white font-medium">Oposição</span> — podes opor-te ao tratamento dos teus dados contactando-nos</li>
            </ul>
            <p className="mt-3 text-sm">
              Para exercer qualquer um destes direitos, acede ao teu{" "}
              <Link href="/dashboard/profile" className="text-green-400 hover:text-green-300">Perfil</Link>{" "}
              ou contacta-nos em{" "}
              <a href="mailto:pedroelias67@gmail.com" className="text-green-400 hover:text-green-300">
                pedroelias67@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Segurança</h2>
            <p className="text-sm">
              Os dados são armazenados em servidores seguros com encriptação em repouso e em trânsito (HTTPS).
              As palavras-passe são armazenadas com hash bcrypt. O acesso à base de dados requer autenticação
              e está protegido por Row-Level Security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Retenção de dados</h2>
            <p className="text-sm">
              Os teus dados são conservados enquanto a tua conta estiver ativa. Ao eliminares a conta,
              todos os dados pessoais são removidos permanentemente no prazo de 30 dias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Alterações a esta política</h2>
            <p className="text-sm">
              Caso alteremos esta política de forma significativa, notificaremos por email com pelo menos
              30 dias de antecedência.
            </p>
          </section>

          <div className="pt-4 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-faint)]">
              Tens dúvidas? Contacta-nos em{" "}
              <a href="mailto:pedroelias67@gmail.com" className="text-green-400 hover:text-green-300">
                pedroelias67@gmail.com
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
