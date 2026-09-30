import { Resend } from "resend";
import { enviarComEspera } from "./email-retry";
import { INTERVALS_STEPS, THRESHOLD_HELP } from "./intervals-setup";
import type { WatchNotice } from "./connection-status";
import {
  emailShell, emailButton, emailHeading, emailText,
  emailBadge, emailStatGrid, emailInfoBox, emailDivider, emailSubheading, EMAIL_COLORS,
} from "./email-template";

// Built on first send, not at import. The constructor throws without a key, and
// at module level that took down every route importing this file — including
// ones that never send, like suspending an account — wherever the key is unset:
// preview deployments, and local development.
let client: Resend | null = null;
function resend(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não está definida neste ambiente");
  return (client ??= new Resend(process.env.RESEND_API_KEY));
}

/**
 * Sends through Resend and throws when it fails.
 *
 * The SDK reports failure by returning `{ error }` rather than throwing, so a
 * bare `await resend.emails.send(...)` inside a try/catch never reaches the
 * catch: a rejected address or a bad key looks exactly like a delivered email.
 *
 * A rate limit is waited out rather than reported — see email-retry.ts.
 */
async function send(message: Parameters<Resend["emails"]["send"]>[0]) {
  await enviarComEspera(async () => (await resend().emails.send(message)).error);
}

const FROM = process.env.FROM_EMAIL ?? "TrainAI <noreply@trainai.pedroelias.com>";
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://trainai.pedroelias.com";

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const url = `${BASE_URL}/auth/verify-email?token=${token}`;
  await send({
    from: FROM,
    to: email,
    subject: "Confirma o teu email — TrainAI",
    html: emailShell({
      previewText: "Confirma o teu email para começares a treinar com o TrainAI.",
      content: `
        ${emailBadge("Confirma a tua conta")}
        ${emailHeading(`Olá, ${name}! 👋`)}
        ${emailText("Estás a um passo de teres o teu treinador pessoal com IA. Confirma o teu email para ativares a conta.")}
        ${emailButton(url, "Confirmar email →")}
        ${emailText("Link válido por 24 horas. Se não criaste uma conta no TrainAI, podes ignorar este email.", true)}
      `,
    }),
  });
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const url = `${BASE_URL}/auth/reset-password?token=${token}`;
  await send({
    from: FROM,
    to: email,
    subject: "Recuperação de password — TrainAI",
    html: emailShell({
      previewText: "Pediste para redefinir a tua password no TrainAI.",
      content: `
        ${emailHeading("Recuperação de password")}
        ${emailText(`Olá, ${name}. Recebemos um pedido para redefinir a password da tua conta.`)}
        ${emailButton(url, "Redefinir password →")}
        ${emailText("Link válido por 1 hora. Se não pediste a recuperação de password, podes ignorar este email com segurança.", true)}
      `,
    }),
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  await send({
    from: FROM,
    to: email,
    subject: "Bem-vindo ao TrainAI 🏃",
    html: emailShell({
      previewText: "A tua conta está ativa. Começa a criar o teu plano de treino personalizado.",
      content: `
        ${emailBadge("Conta ativada")}
        ${emailHeading(`${name}, está tudo pronto! 🎉`)}
        ${emailText("A tua conta TrainAI está ativa. Aqui estão os próximos passos para começares:")}
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px">
          ${[
            { n: "1", title: "Cria o teu evento", desc: "Escolhe uma corrida ou triatlo e a IA gera o plano." },
            { n: "2", title: "Liga o Strava", desc: "Sincronização automática após cada treino." },
            { n: "3", title: "Recebe os treinos no relógio", desc: "Garmin, COROS, Suunto ou Wahoo, através do Intervals.icu." },
          ].map(s => `
            <tr><td style="padding-bottom:12px">
              <div style="display:flex;align-items:flex-start;gap:12px">
                <div style="width:24px;height:24px;border-radius:50%;background:${EMAIL_COLORS.ACCENT};color:#ffffff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${s.n}</div>
                <div>
                  <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:${EMAIL_COLORS.HEADING}">${s.title}</p>
                  <p style="margin:0;font-size:12px;color:${EMAIL_COLORS.MUTED}">${s.desc}</p>
                </div>
              </div>
            </td></tr>
          `).join("")}
        </table>
        ${emailButton(`${BASE_URL}/dashboard`, "Ir para o Dashboard →")}
      `,
    }),
  });
}

export async function sendWeeklyReportEmail(
  email: string,
  name: string,
  data: {
    weekNumber: number;
    completedSessions: number;
    plannedSessions: number;
    actualDistance: number;
    plannedDistance: number | null;
    aiSummary: string;
    nextWeekAdaptations: string | null;
    eventName: string;
    weeksToEvent: number;
    /** Next week's sessions could not be adjusted — say so rather than let it pass unnoticed. */
    adaptationFailed?: boolean;
  }
) {
  const completionPct = data.plannedSessions > 0
    ? Math.round((data.completedSessions / data.plannedSessions) * 100) : 0;
  const distancePct = data.plannedDistance
    ? Math.round(Math.min((data.actualDistance / data.plannedDistance) * 100, 100)) : null;

  await send({
    from: FROM,
    to: email,
    subject: `📊 Semana ${data.weekNumber} — Relatório TrainAI`,
    html: emailShell({
      previewText: `Completaste ${data.completedSessions} de ${data.plannedSessions} treinos esta semana.`,
      content: `
        ${emailBadge(`Semana ${data.weekNumber} · ${data.eventName}`)}
        ${emailHeading(`Olá, ${name}! 👋`)}
        ${emailText("A tua semana de treino terminou. Aqui está o resumo e a análise do teu treinador IA.")}

        ${emailStatGrid([
          { value: `${data.completedSessions}/${data.plannedSessions}`, label: "Treinos" },
          { value: `${data.actualDistance.toFixed(1)}`, label: "km" },
          { value: `${completionPct}%`, label: "Cumprimento" },
        ])}

        ${distancePct !== null ? `
          <div style="margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:12px;color:${EMAIL_COLORS.MUTED}">Volume: ${data.actualDistance.toFixed(1)} / ${data.plannedDistance?.toFixed(1)} km</span>
              <span style="font-size:12px;color:${EMAIL_COLORS.ACCENT};font-weight:600">${distancePct}%</span>
            </div>
            <div style="background:${EMAIL_COLORS.BORDER};border-radius:4px;height:5px;overflow:hidden">
              <div style="background:${EMAIL_COLORS.ACCENT};width:${distancePct}%;height:100%;border-radius:4px"></div>
            </div>
          </div>
        ` : ""}

        ${emailInfoBox("✦ Análise do Treinador IA", data.aiSummary)}
        ${data.nextWeekAdaptations ? emailInfoBox(`Semana ${data.weekNumber + 1} — Ajustes`, data.nextWeekAdaptations, "#1d4ed8") : ""}
        ${data.adaptationFailed
          ? emailInfoBox(
              "Atenção",
              `Não foi possível ajustar automaticamente as sessões da semana ${data.weekNumber + 1} desta vez. O plano mantém-se como estava — segue a análise acima ao executá-lo. Já fomos notificados.`,
              "#a16207"
            )
          : ""}

        ${emailDivider()}
        <p style="margin:0 0 16px;font-size:13px;color:${EMAIL_COLORS.MUTED};text-align:center">
          🎯 ${data.eventName} — faltam <strong style="color:${EMAIL_COLORS.HEADING}">${data.weeksToEvent}</strong> semanas
        </p>

        ${emailButton(`${BASE_URL}/dashboard`, "Ver Dashboard →")}
      `,
    }),
  });
}

export async function sendInviteEmail(email: string, token: string, inviterName: string) {
  const url = `${BASE_URL}/invite/${token}`;
  await send({
    from: FROM,
    to: email,
    subject: `${inviterName} convidou-te para o TrainAI`,
    html: emailShell({
      previewText: `${inviterName} convidou-te para o TrainAI — treino com IA para corredores e triatletas.`,
      content: `
        ${emailBadge("Convite exclusivo")}
        ${emailHeading("Foste convidado! 🎉")}
        ${emailText(`<strong style="color:${EMAIL_COLORS.HEADING}">${inviterName}</strong> convidou-te para o TrainAI — planos de treino personalizados com inteligência artificial para corredores e triatletas.`)}
        ${emailStatGrid([
          { value: "IA", label: "Planos personalizados" },
          { value: "PWA", label: "Funciona offline" },
          { value: "⌚", label: "Treinos no relógio" },
        ])}
        ${emailButton(url, "Aceitar convite →")}
        ${emailText("Convite válido por 7 dias.", true)}
      `,
    }),
  });
}

export async function sendFeedbackEmail(data: {
  name: string;
  email: string;
  category: string;
  message: string;
}) {
  const categoryLabels: Record<string, string> = {
    bug: "🐛 Bug / Erro",
    suggestion: "💡 Sugestão",
    praise: "⭐ Elogio",
    question: "❓ Questão",
  };

  await send({
    from: FROM,
    to: "pedro@trainai.pedroelias.com",
    replyTo: data.email,
    subject: `[TrainAI Feedback] ${categoryLabels[data.category] ?? data.category} — ${data.name}`,
    html: emailShell({
      previewText: `Novo feedback de ${data.name}: ${data.message.slice(0, 80)}`,
      content: `
        ${emailBadge("Feedback in-app")}
        ${emailHeading("Novo feedback recebido")}
        ${emailStatGrid([
          { value: categoryLabels[data.category] ?? data.category, label: "Categoria" },
        ])}
        ${emailInfoBox("Mensagem", data.message)}
        ${emailDivider()}
        ${emailText(`<strong style="color:${EMAIL_COLORS.HEADING}">De:</strong> ${data.name} &lt;${data.email}&gt;`, true)}
      `,
    }),
  });

  // Confirmation to the user
  await send({
    from: FROM,
    to: data.email,
    subject: "Recebemos o teu feedback — TrainAI",
    html: emailShell({
      previewText: "Obrigado pelo teu feedback. Responderemos em breve.",
      content: `
        ${emailHeading(`Obrigado, ${data.name}! 🙏`)}
        ${emailText("Recebemos o teu feedback e vamos analisá-lo com atenção.")}
        ${emailInfoBox("A tua mensagem", data.message)}
        ${emailText("Responderemos por email se necessário. Entretanto, podes continuar a usar o TrainAI normalmente.", true)}
        ${emailButton(`${BASE_URL}/dashboard`, "Voltar ao Dashboard →")}
      `,
    }),
  });
}

/**
 * Tells an athlete their planned workouts are not reaching their watch.
 *
 * The app says the same thing on their dashboard, but only once they open it.
 * Someone whose activities arrive through Strava has no reason to think
 * anything is wrong, so they may never open it to find out.
 *
 * What the mail says comes from the same diagnosis the dashboard shows, so the
 * two cannot tell the athlete different things.
 */
export function watchSetupEmail(name: string, notice: WatchNotice): { subject: string; html: string } {
  const passos = `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px">
      ${INTERVALS_STEPS.map((s, i) => `
        <tr><td style="padding-bottom:12px">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="width:24px;height:24px;border-radius:50%;background:${EMAIL_COLORS.ACCENT};color:#ffffff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>
            <div>
              <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:${EMAIL_COLORS.HEADING}">${s.title}</p>
              <p style="margin:0;font-size:12px;color:${EMAIL_COLORS.MUTED}">${s.detail}</p>
            </div>
          </div>
        </td></tr>
      `).join("")}
    </table>`;

  const corpo = (() => {
    switch (notice.reason) {
      case "not-connected":
        return `
          ${emailText(
            "Os teus treinos planeados não estão a chegar ao teu relógio. As tuas corridas chegam à " +
            "app pelo Strava e a análise semanal funciona — falta o caminho contrário, o que leva o " +
            "treino do dia ao pulso."
          )}
          ${emailText(
            "Faz-se através do Intervals.icu, que é gratuito e serve de ponte para Garmin, COROS, " +
            "Suunto e Wahoo. Configura-se uma vez:"
          )}
          ${passos}
          ${emailButton(`${BASE_URL}/dashboard/profile`, "Ligar o relógio →")}`;

      case "no-threshold":
        return `
          ${emailText(
            "Os treinos estão a chegar ao teu relógio, mas sem ritmo nenhum. Cada fase aparece só " +
            "com a duração, e o relógio acaba a orientar-te pela frequência cardíaca."
          )}
          ${emailInfoBox("Falta uma definição", THRESHOLD_HELP.why, "#a16207")}
          ${emailText(`Onde se preenche: <strong>${THRESHOLD_HELP.where}</strong>`)}
          ${emailButton("https://intervals.icu/settings", "Abrir definições do Intervals.icu →")}`;

      default:
        return `
          ${emailText(notice.detail)}
          ${emailButton(`${BASE_URL}${notice.action.external ? "/dashboard/plan" : notice.action.href}`, "Abrir o TrainAI →")}`;
    }
  })();

  return {
    subject: `⌚ ${notice.title}`,
    html: emailShell({
      previewText: notice.detail,
      content: `
        ${emailBadge("O teu relógio")}
        ${emailHeading(`${name}, ${notice.title.charAt(0).toLowerCase()}${notice.title.slice(1)}`)}
        ${corpo}
        ${emailText("Se precisares de ajuda com algum passo, responde a este email.", true)}
      `,
    }),
  };
}

/** Builds it and sends it. Split so the mail can be looked at without sending one. */
export async function sendWatchSetupEmail(email: string, name: string, notice: WatchNotice) {
  const { subject, html } = watchSetupEmail(name, notice);
  await send({ from: FROM, to: email, subject, html });
}
