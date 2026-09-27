// Waiting out a rate limit instead of losing the email.
//
// Resend accepts two requests a second. The Sunday job now works on several
// athletes at once, so their reports can reach Resend together — and a refused
// send is an athlete who hears nothing, which is the failure this whole job
// exists to avoid. A rate limit is "come back shortly", not "no".

/** What the Resend SDK hands back instead of throwing. */
export type FalhaDeEnvio = { name?: string | null; message?: string | null };

/** Waits between attempts, growing: 400ms, 800ms, 1600ms. */
const ESPERA_MS = [400, 800, 1600];

/** Whether this failure is worth retrying rather than reporting. */
export function limitePorRitmo(error: FalhaDeEnvio): boolean {
  return /rate.?limit|too.?many.?requests|\b429\b/i.test(`${error.name ?? ""} ${error.message ?? ""}`);
}

/**
 * Sends, retrying only while the answer is a rate limit.
 *
 * Anything else — a rejected address, a bad key — fails immediately: repeating
 * it would not change the answer.
 */
export async function enviarComEspera(
  enviar: () => Promise<FalhaDeEnvio | null | undefined>,
  esperar: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))
): Promise<void> {
  for (let tentativa = 0; ; tentativa++) {
    const error = await enviar();
    if (!error) return;
    if (!limitePorRitmo(error) || tentativa >= ESPERA_MS.length) {
      throw new Error(`Resend: ${error.name ?? "erro"} — ${error.message ?? "sem detalhe"}`);
    }
    await esperar(ESPERA_MS[tentativa]);
  }
}
