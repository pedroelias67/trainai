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
