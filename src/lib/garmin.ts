// What the athlete's own watch measured, straight from Garmin.
//
// The weekly adaptation has always asked how the athlete is: sleep, fatigue and
// mood, one to five, typed in by hand on the days they remembered. That is an
// opinion, offered irregularly. The watch has the measurement — how long they
// actually slept and what their overnight heart-rate variability did — and
// Garmin's personal API hands it over with no application and no gatekeeper.
//
// Personal keys are per-athlete and read-only: this gives us one person's own
// data, not a way to reach anyone else's. Pull only, so we ask rather than
// being told, which is why this runs on the Sunday job and on demand instead of
// waiting for a webhook.
//
// It does not include the Training API. Workouts still reach the watch through
// Intervals.icu; see watch-integrations in the project notes for why.

const API = "https://personal.connectapi.garmin.com";

/** Garmin's own wording for where the night's HRV sat against the athlete's baseline. */
export type HrvStatus = "NONE" | "POOR" | "LOW" | "UNBALANCED" | "BALANCED" | "INVALID";

export type GarminDayData = {
  date: string; // yyyy-mm-dd
  sleepSeconds: number | null;
  deepSleepSeconds: number | null;
  remSleepSeconds: number | null;
  awakeSeconds: number | null;
  hrvLastNight: number | null;
  hrvWeeklyAvg: number | null;
  hrvStatus: HrvStatus | null;
};

export type GarminResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Trades the personal API key for an access token.
 *
 * Done on every read rather than stored. The key is long-lived and chosen by
 * the athlete; the token is short-lived and only ever needed for the few
 * seconds of a sync, so keeping one would be a second secret to hold, go stale
 * and leak, for nothing.
 */
export async function obtainAccessToken(apiKey: string): Promise<GarminResult<string>> {
  let res: Response;
  try {
    res = await fetch(`${API}/personalapitoken-service/personal-api/personal-api-key/token`, {
      method: "POST",
      headers: { Authorization: `ApiKey ${apiKey}` },
    });
  } catch {
    return { ok: false, error: "Não foi possível contactar a Garmin" };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "A Garmin recusou a chave. Confirma que a copiaste inteira e que não expirou." };
  }
  if (!res.ok) return { ok: false, error: `A Garmin respondeu ${res.status}` };

  // The token comes back either bare or wrapped; accept both rather than
  // guessing, since a wrong guess here reads as "key refused".
  const corpo = await res.text();
  const token = (() => {
    try {
      const j = JSON.parse(corpo);
      return j.access_token ?? j.accessToken ?? j.token ?? (typeof j === "string" ? j : null);
    } catch {
      return corpo.trim() || null;
    }
  })();

  return token ? { ok: true, data: String(token) } : { ok: false, error: "A Garmin não devolveu um token" };
}

const diaCivil = (d: Date) => d.toISOString().slice(0, 10);

async function ler(token: string, caminho: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${API}${caminho}`, { headers: { Authorization: `Bearer ${token}` } });
    // 204 is Garmin's way of saying the athlete simply has no data for those
    // days — a watch left on the bedside table, a holiday. Not a failure.
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

type SleepRow = {
  calendarDate?: string;
  sleepTimeSeconds?: number | null;
  deepSleepSeconds?: number | null;
  remSleepSeconds?: number | null;
  awakeSleepSeconds?: number | null;
};

type HrvRow = {
  calendarDate?: string;
  lastNightAvg?: number | null;
  weeklyAvg?: number | null;
  status?: string | null;
};

/**
 * Sleep and overnight HRV for a stretch of days, merged by date.
 *
 * Two calls, both of which take a range — Garmin caps those at 31 days, which
 * is well beyond the week the adaptation looks at. A day the watch did not
 * record is simply absent rather than zero: nothing measured is not the same as
 * no sleep, and the difference matters to anything reading it afterwards.
 */
export async function fetchGarminDays(
  apiKey: string,
  from: Date,
  to: Date
): Promise<GarminResult<GarminDayData[]>> {
  const token = await obtainAccessToken(apiKey);
  if (!token.ok) return token;

  const inicio = diaCivil(from);
  const fim = diaCivil(to);

  const [sono, hrv] = await Promise.all([
    ler(token.data, `/sleep-service/sleep/dailySleepSummariesByDate?startDate=${inicio}&endDate=${fim}`),
    ler(token.data, `/hrv-service/hrv/daily/${inicio}/${fim}`),
  ]);

  const porDia = new Map<string, GarminDayData>();
  const obter = (date: string): GarminDayData => {
    if (!porDia.has(date)) {
      porDia.set(date, {
        date, sleepSeconds: null, deepSleepSeconds: null, remSleepSeconds: null,
        awakeSeconds: null, hrvLastNight: null, hrvWeeklyAvg: null, hrvStatus: null,
      });
    }
    return porDia.get(date)!;
  };

  for (const linha of (Array.isArray(sono) ? sono : []) as SleepRow[]) {
    if (!linha?.calendarDate) continue;
    const d = obter(linha.calendarDate);
    d.sleepSeconds = linha.sleepTimeSeconds ?? null;
    d.deepSleepSeconds = linha.deepSleepSeconds ?? null;
    d.remSleepSeconds = linha.remSleepSeconds ?? null;
    d.awakeSeconds = linha.awakeSleepSeconds ?? null;
  }

  const resumos = (hrv as { hrvSummaries?: HrvRow[] } | null)?.hrvSummaries ?? [];
  for (const linha of resumos) {
    if (!linha?.calendarDate) continue;
    const d = obter(linha.calendarDate);
    d.hrvLastNight = linha.lastNightAvg ?? null;
    d.hrvWeeklyAvg = linha.weeklyAvg ?? null;
    d.hrvStatus = (linha.status as HrvStatus) ?? null;
  }

  return { ok: true, data: [...porDia.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

const horas = (segundos: number) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  return `${h}h${String(m).padStart(2, "0")}`;
};

/** How Garmin words its HRV verdict, in the athlete's language. */
const ESTADO_HRV: Record<string, string> = {
  BALANCED: "equilibrado",
  UNBALANCED: "desequilibrado",
  LOW: "baixo",
  POOR: "muito baixo",
};

/**
 * The measured days, written for the weekly adaptation.
 *
 * Says what was measured and what was not. A model given "sono=?" for four of
 * seven days should know those nights are missing rather than bad.
 */
export function garminWellnessSummary(dias: GarminDayData[]): string {
  const comAlgo = dias.filter(d => d.sleepSeconds !== null || d.hrvLastNight !== null);
  if (comAlgo.length === 0) return "";

  const linhas = comAlgo.map(d => {
    const partes: string[] = [];
    if (d.sleepSeconds !== null) {
      const profundo = d.deepSleepSeconds !== null ? `, profundo ${horas(d.deepSleepSeconds)}` : "";
      partes.push(`dormiu ${horas(d.sleepSeconds)}${profundo}`);
    }
    if (d.hrvLastNight !== null) {
      const estado = d.hrvStatus ? ` (${ESTADO_HRV[d.hrvStatus] ?? d.hrvStatus.toLowerCase()})` : "";
      partes.push(`HRV ${d.hrvLastNight}ms${estado}`);
    }
    return `- ${d.date}: ${partes.join(", ")}`;
  });

  const semMedicao = dias.length - comAlgo.length;
  return [
    "MEDIDO PELO RELÓGIO (Garmin):",
    ...linhas,
    semMedicao > 0 ? `(${semMedicao} dia(s) sem medição — o relógio não esteve posto, não é sinal de nada.)` : "",
    "Isto é medição, não opinião. Uma noite curta ou um HRV abaixo da linha de base do atleta",
    "justificam aliviar; vários dias seguidos assim justificam-no com mais força do que qualquer",
    "registo manual.",
  ].filter(Boolean).join("\n");
}
