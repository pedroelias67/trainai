import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL ?? "TrainAI <noreply@trainai.pedroelias.com>";
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://trainai.pedroelias.com";

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const url = `${BASE_URL}/auth/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Confirma o teu email — TrainAI",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e4e4e7;border-radius:16px">
        <h1 style="color:#22c55e;font-size:24px;margin-bottom:8px">TrainAI</h1>
        <h2 style="font-size:18px;margin-bottom:16px">Olá ${name} 👋</h2>
        <p style="color:#a1a1aa;margin-bottom:24px">Confirma o teu email para começares a treinar.</p>
        <a href="${url}" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:15px">Confirmar email</a>
        <p style="color:#52525b;font-size:12px;margin-top:24px">Link válido por 24 horas. Se não criaste uma conta, ignora este email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const url = `${BASE_URL}/auth/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Recuperação de password — TrainAI",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e4e4e7;border-radius:16px">
        <h1 style="color:#22c55e;font-size:24px;margin-bottom:8px">TrainAI</h1>
        <h2 style="font-size:18px;margin-bottom:16px">Recuperação de password</h2>
        <p style="color:#a1a1aa;margin-bottom:24px">Pediste para redefinir a tua password, ${name}.</p>
        <a href="${url}" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:15px">Redefinir password</a>
        <p style="color:#52525b;font-size:12px;margin-top:24px">Link válido por 1 hora. Se não pediste isto, ignora este email.</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Bem-vindo ao TrainAI 🏃",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e4e4e7;border-radius:16px">
        <h1 style="color:#22c55e;font-size:24px;margin-bottom:8px">TrainAI</h1>
        <h2 style="font-size:18px;margin-bottom:16px">A tua conta está confirmada, ${name}!</h2>
        <p style="color:#a1a1aa;margin-bottom:16px">Estás pronto para começar. Próximos passos:</p>
        <ul style="color:#a1a1aa;padding-left:20px;margin-bottom:24px;line-height:2">
          <li>Cria o teu primeiro plano de treino com IA</li>
          <li>Liga o Strava para sincronização automática</li>
          <li>Exporta treinos para o teu relógio Garmin</li>
        </ul>
        <a href="${BASE_URL}/dashboard" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:15px">Ir para o Dashboard</a>
      </div>
    `,
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
  }
) {
  const completionPct = data.plannedSessions > 0
    ? Math.round((data.completedSessions / data.plannedSessions) * 100)
    : 0;
  const distanceBar = data.plannedDistance
    ? Math.round(Math.min((data.actualDistance / data.plannedDistance) * 100, 100))
    : null;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `📊 Semana ${data.weekNumber} — Relatório TrainAI`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#e4e4e7;border-radius:16px">
        <h1 style="color:#22c55e;font-size:22px;margin:0 0 4px">TrainAI</h1>
        <p style="color:#71717a;font-size:13px;margin:0 0 28px">Relatório Semanal</p>

        <h2 style="font-size:18px;color:#fff;margin:0 0 6px">Olá ${name} 👋</h2>
        <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px">
          A semana ${data.weekNumber} terminou. Aqui está o resumo do teu treino.
        </p>

        <!-- Stats -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr>
            <td style="background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:16px;text-align:center;width:33%">
              <p style="font-size:28px;font-weight:700;color:#22c55e;margin:0">${data.completedSessions}/${data.plannedSessions}</p>
              <p style="font-size:12px;color:#71717a;margin:4px 0 0">treinos</p>
            </td>
            <td style="width:8px"></td>
            <td style="background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:16px;text-align:center;width:33%">
              <p style="font-size:28px;font-weight:700;color:#fff;margin:0">${data.actualDistance.toFixed(1)}</p>
              <p style="font-size:12px;color:#71717a;margin:4px 0 0">km percorridos</p>
            </td>
            <td style="width:8px"></td>
            <td style="background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:16px;text-align:center;width:33%">
              <p style="font-size:28px;font-weight:700;color:#fff;margin:0">${completionPct}%</p>
              <p style="font-size:12px;color:#71717a;margin:4px 0 0">concluído</p>
            </td>
          </tr>
        </table>

        ${distanceBar !== null ? `
        <!-- Progress bar -->
        <div style="margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:12px;color:#a1a1aa">Volume: ${data.actualDistance.toFixed(1)} / ${data.plannedDistance?.toFixed(1)} km</span>
            <span style="font-size:12px;color:#22c55e">${distanceBar}%</span>
          </div>
          <div style="background:#1a1a1a;border-radius:4px;height:6px;overflow:hidden">
            <div style="background:#22c55e;width:${distanceBar}%;height:100%;border-radius:4px"></div>
          </div>
        </div>
        ` : ""}

        <!-- AI Summary -->
        <div style="background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:20px;margin-bottom:20px">
          <p style="font-size:11px;color:#22c55e;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;font-weight:600">✦ Análise do Treinador IA</p>
          <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:0;white-space:pre-line">${data.aiSummary}</p>
        </div>

        ${data.nextWeekAdaptations ? `
        <!-- Next week -->
        <div style="background:#0f1a0f;border:1px solid #14532d;border-radius:12px;padding:20px;margin-bottom:24px">
          <p style="font-size:11px;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;font-weight:600">Semana ${data.weekNumber + 1} — Ajustes</p>
          <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:0;white-space:pre-line">${data.nextWeekAdaptations}</p>
        </div>
        ` : ""}

        <!-- Event countdown -->
        <p style="font-size:13px;color:#52525b;text-align:center;margin-bottom:24px">
          🎯 ${data.eventName} — faltam <strong style="color:#fff">${data.weeksToEvent}</strong> semanas
        </p>

        <a href="${BASE_URL}/dashboard" style="display:block;background:#22c55e;color:#000;font-weight:700;padding:14px;border-radius:12px;text-decoration:none;font-size:15px;text-align:center">
          Ver Dashboard →
        </a>

        <p style="color:#3f3f46;font-size:11px;margin-top:24px;text-align:center">
          TrainAI · <a href="${BASE_URL}/privacy" style="color:#3f3f46">Privacidade</a> · <a href="${BASE_URL}/dashboard/profile" style="color:#3f3f46">Gerir notificações</a>
        </p>
      </div>
    `,
  });
}

export async function sendInviteEmail(email: string, token: string, inviterName: string) {
  const url = `${BASE_URL}/auth/register?invite=${token}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${inviterName} convidou-te para o TrainAI`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e4e4e7;border-radius:16px">
        <h1 style="color:#22c55e;font-size:24px;margin-bottom:8px">TrainAI</h1>
        <h2 style="font-size:18px;margin-bottom:16px">Foste convidado!</h2>
        <p style="color:#a1a1aa;margin-bottom:24px">${inviterName} convidou-te para usar o TrainAI — planos de treino personalizados com IA para corredores e triatletas.</p>
        <a href="${url}" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:15px">Aceitar convite</a>
        <p style="color:#52525b;font-size:12px;margin-top:24px">Convite válido por 7 dias.</p>
      </div>
    `,
  });
}
