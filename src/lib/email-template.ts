const BASE_URL = process.env.NEXTAUTH_URL ?? "https://trainai.pedroelias.com";

// Shared email shell — wrap any content in a consistent, polished layout
export function emailShell({
  previewText,
  content,
}: {
  previewText: string;
  content: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TrainAI</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${previewText}&nbsp;‌&nbsp;‌&nbsp;‌</div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px">

        <!-- Header -->
        <tr><td style="padding-bottom:28px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td>
                <div style="display:inline-flex;align-items:center;gap:10px">
                  <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#4ade80,#16a34a);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:#000">T</div>
                  <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">TrainAI</span>
                </div>
              </td>
              <td align="right">
                <span style="font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:1px">O teu treinador IA</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#111111;border:1px solid #1f1f1f;border-radius:16px;padding:32px;overflow:hidden">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding-bottom:12px;border-bottom:1px solid #1a1a1a">
              <a href="${BASE_URL}/dashboard" style="color:#52525b;text-decoration:none;font-size:12px;margin:0 8px">Dashboard</a>
              <a href="${BASE_URL}/privacy" style="color:#52525b;text-decoration:none;font-size:12px;margin:0 8px">Privacidade</a>
              <a href="${BASE_URL}/status" style="color:#52525b;text-decoration:none;font-size:12px;margin:0 8px">Estado</a>
              <a href="mailto:pedro@trainai.pedroelias.com" style="color:#52525b;text-decoration:none;font-size:12px;margin:0 8px">Suporte</a>
            </td></tr>
            <tr><td style="padding-top:12px">
              <p style="margin:0;font-size:11px;color:#3f3f46;line-height:1.6">
                TrainAI · Plataforma de treino com IA para corredores e triatletas<br>
                Se não quiseres receber estes emails, <a href="${BASE_URL}/dashboard/profile" style="color:#3f3f46;text-decoration:underline">gere as notificações</a>.
              </p>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Reusable blocks ───────────────────────────────────────────────────────────

export function emailButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0">
    <tr><td style="border-radius:12px;background:#22c55e">
      <a href="${href}" style="display:inline-block;padding:14px 28px;color:#000;font-weight:700;font-size:15px;text-decoration:none;border-radius:12px;letter-spacing:-0.2px">${label}</a>
    </td></tr>
  </table>`;
}

export function emailDivider(): string {
  return `<div style="border-top:1px solid #1f1f1f;margin:24px 0"></div>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">${text}</h1>`;
}

export function emailSubheading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#ffffff">${text}</h2>`;
}

export function emailText(text: string, muted = false): string {
  return `<p style="margin:0 0 16px;font-size:14px;color:${muted ? "#71717a" : "#a1a1aa"};line-height:1.7">${text}</p>`;
}

export function emailBadge(text: string): string {
  return `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:20px;padding:4px 12px;margin-bottom:20px">
    <div style="width:6px;height:6px;border-radius:50%;background:#22c55e"></div>
    <span style="font-size:12px;font-weight:600;color:#4ade80">${text}</span>
  </div>`;
}

export function emailStatGrid(stats: { label: string; value: string }[]): string {
  const cells = stats.map(s => `
    <td style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;padding:14px;text-align:center;width:${Math.floor(100 / stats.length)}%">
      <p style="margin:0 0 4px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-1px">${s.value}</p>
      <p style="margin:0;font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.5px">${s.label}</p>
    </td>
  `).join('<td style="width:6px"></td>');
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px"><tr>${cells}</tr></table>`;
}

export function emailInfoBox(title: string, body: string, color = "#22c55e"): string {
  return `<div style="border-left:3px solid ${color};padding:14px 16px;background:#0a0a0a;border-radius:0 10px 10px 0;margin-bottom:16px">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px">${title}</p>
    <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.7;white-space:pre-line">${body}</p>
  </div>`;
}
