import Anthropic from "@anthropic-ai/sdk";
import { inferThresholdPace, zonePaceTable } from "./intervals-icu";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const CLAUDE_MODEL = "claude-sonnet-4-6";

export interface TrainingPlanRequest {
  athlete: {
    name: string;
    age: number;
    gender: string;
    fitnessLevel: string;
    weeklyHours: number;
    trainingDaysPerWeek?: number;
    longRunDay?: number;
    preferredDays?: number[]; // 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb, 7=Dom
    restingHR?: number;
    maxHR?: number;
    ltPace?: string;
    ftp?: number;
  };
  event: {
    name: string;
    sport: string;
    distance: string;
    date: string;
    goalType: string;
    goalTime?: string;
  };
  currentDate: string;
  weeksUntilEvent: number;
  /** How many weeks to materialise now; the rest are added as the athlete advances. */
  weeksToGenerate?: number;
}

export interface WeeklyAnalysisRequest {
  athlete: {
    name: string;
    fitnessLevel: string;
  };
  plannedSessions: Array<{
    name: string;
    sport: string;
    sessionType: string;
    plannedDistance?: number;
    plannedDuration?: number;
    plannedPace?: string;
  }>;
  completedActivities: Array<{
    name: string;
    sport: string;
    date: string;
    distance?: number;
    duration?: number;
    avgHR?: number;
    avgPace?: string;
    trainingLoad?: number;
  }>;
  weekNumber: number;
  totalWeeks: number;
  eventName: string;
  eventDate: string;
}

export async function analyzeWeekAndAdapt(request: WeeklyAnalysisRequest): Promise<{
  summary: string;
  adaptations: string;
  nextWeekAdjustments: string;
}> {
  const prompt = `És o melhor treinador de corrida e triatlo do mundo. Analisa com rigor científico a semana de treino do atleta e fornece feedback de nível olímpico.

ATLETA: ${request.athlete.name} (Nível: ${request.athlete.fitnessLevel})
EVENTO: ${request.eventName} em ${request.eventDate}
SEMANA: ${request.weekNumber} de ${request.totalWeeks} (${Math.round((request.weekNumber / request.totalWeeks) * 100)}% do plano concluído)

TREINOS PLANEADOS:
${JSON.stringify(request.plannedSessions, null, 2)}

ATIVIDADES REALIZADAS:
${JSON.stringify(request.completedActivities, null, 2)}

Analisa:
1. Cumprimento do plano (volume, intensidade, distribuição de zonas)
2. Sinais de fadiga acumulada ou subcarregamento
3. Tendências de progressão (FC a baixar para o mesmo pace = boa forma)
4. Risco de lesão ou overtraining
5. Ajustes necessários para a semana seguinte

Quando usares termos técnicos (VO2max, LT, overtraining, carga de treino, TSS, CTL, ATL, etc.), explica-os brevemente entre parênteses na primeira vez que os uses.

Responde em JSON com EXATAMENTE esta estrutura:
{
  "summary": "análise detalhada da semana (3-4 parágrafos): o que correu bem, o que falhou, dados chave observados, estado de forma atual",
  "adaptations": "avaliação da adaptação fisiológica em curso e sinais de progressão ou regressão",
  "nextWeekAdjustments": "instruções concretas e justificadas para a semana seguinte: volumes, intensidades, sessões a modificar ou eliminar"
}

Responde APENAS com JSON válido, sem markdown.`;

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Resposta inesperada da IA");
  const text = content.text.replace(/^```(?:json)?\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();
  return JSON.parse(text);
}

export interface SessionAdjustment {
  sessionId: string;
  action: "reduce_distance" | "reduce_intensity" | "convert_to_easy" | "increase_distance" | "keep";
  distanceMultiplier?: number;   // e.g. 0.8 = reduce 20%
  durationMultiplier?: number;
  convertToType?: string;        // e.g. "EASY"
  newPace?: string;
  reason: string;
}

export async function suggestSessionAdaptations(params: {
  analysis: string;
  nextWeekAdjustments: string;
  wellnessSummary: string;
  sessions: Array<{ id: string; name: string; sessionType: string; plannedDistance: number | null; plannedDuration: number | null; plannedPace: string | null }>;
}): Promise<SessionAdjustment[]> {
  const prompt = `Com base na análise semanal e nos dados de bem-estar do atleta, sugere ajustes concretos para as sessões da próxima semana.

ANÁLISE DA SEMANA:
${params.analysis}

AJUSTES RECOMENDADOS (texto do coach):
${params.nextWeekAdjustments}

ESTADO DE BEM-ESTAR DO ATLETA:
${params.wellnessSummary}

SESSÕES DA PRÓXIMA SEMANA:
${JSON.stringify(params.sessions, null, 2)}

Para cada sessão, indica o ajuste a fazer. Usa apenas as ações: "reduce_distance", "reduce_intensity", "convert_to_easy", "increase_distance", "keep".
- Se o atleta está fatigado: reduz volume ou converte para fácil
- Se correu menos do que planeado: mantém ou aumenta ligeiramente
- Se está em boa forma: mantém ou aumenta progressivamente (máx +10%)

Responde em JSON com EXATAMENTE esta estrutura (array):
[
  {
    "sessionId": "id da sessão",
    "action": "reduce_distance",
    "distanceMultiplier": 0.85,
    "durationMultiplier": 0.85,
    "reason": "Fadiga elevada esta semana — reduz 15% do volume para recuperar"
  }
]

Responde APENAS com JSON válido (array), sem markdown.`;

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Resposta inesperada da IA");
  const text = content.text.replace(/^```(?:json)?\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();
  return JSON.parse(text);
}

// ── Two-phase plan generation ────────────────────────────────────────────────
//
// Writing every session in full takes the model around four minutes, which the
// athlete waits through during onboarding before seeing anything at all. The
// structure alone takes about 17 seconds, and a week's worth of detail about 40.
// So the plan is produced in two phases: the skeleton first, so the plan exists
// and is browsable, then the prose for one week at a time.

const DIAS_PT = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

function calendarRules(athlete: TrainingPlanRequest["athlete"]): string {
  const dias = athlete.trainingDaysPerWeek ?? 5;
  const longo = athlete.longRunDay && athlete.longRunDay > 0 ? athlete.longRunDay : 7;
  const preferidos = athlete.preferredDays?.length
    ? `\nDIAS PERMITIDOS: apenas ${athlete.preferredDays.map(d => `${d}=${DIAS_PT[d]}`).join(", ")}. Nenhuma sessão fora destes dias.`
    : "";

  return `REGRAS DE CALENDÁRIO (invioláveis):
- Cada semana tem EXATAMENTE ${dias} sessões.
- Quando a semana incluir um treino LONG, ele vai em dayOfWeek=${longo} (${DIAS_PT[longo]}).
  Isto define onde o longo cai, não que tenha de existir: semanas de recuperação
  ou de taper podem não ter nenhum.
- Nunca INTERVALS ou TEMPO em dias seguidos; nunca LONG no dia seguinte a um desses.
- dayOfWeek: 1=Segunda … 7=Domingo.${preferidos}`;
}

/**
 * Triathlon needs saying explicitly. Left to itself the model produces a tidy
 * plan covering all three disciplines and no brick sessions at all — the one
 * session that trains the transition and running on tired legs, and the most
 * sport-specific thing in the whole block.
 */
function triathlonGuidance(sport: string): string {
  if (!sport.startsWith("TRIATHLON")) return "";
  return `
TRIATLO — obrigatório:
- Cada semana cobre as três modalidades: natação, ciclismo e corrida.
- Inclui uma sessão BRICK por semana, exceto nas semanas de recuperação e de
  taper: ciclismo seguido imediatamente de corrida. Regista-a com sport=CYCLING
  e sessionType=BRICK.
- O longo de bicicleta e o longo de corrida ficam em dias diferentes.
- Em atletas iniciantes a natação privilegia técnica: o ganho vem mais da
  eficiência do que do volume.
`;
}

/** Structure only: no prose, so this returns in seconds rather than minutes. */
export async function generatePlanSkeleton(request: TrainingPlanRequest): Promise<string> {
  const prompt = `És um treinador de elite de corrida e triatlo. Cria a ESTRUTURA de um plano de treino.

ATLETA: ${request.athlete.name}, ${request.athlete.age} anos, ${request.athlete.gender}
Nível: ${request.athlete.fitnessLevel} | ${request.athlete.weeklyHours}h disponíveis por semana
${request.athlete.maxHR ? `FC máxima: ${request.athlete.maxHR} bpm` : ""}
${request.athlete.ltPace ? `Pace de limiar: ${request.athlete.ltPace}` : ""}

EVENTO: ${request.event.name} — ${request.event.distance} (${request.event.sport}) em ${request.event.date}
Objetivo: ${request.event.goalType}${request.event.goalTime ? ` em ${request.event.goalTime}` : ""}
Data de hoje: ${request.currentDate} | Semanas disponíveis: ${request.weeksUntilEvent}

${calendarRules(request.athlete)}
${triathlonGuidance(request.event.sport)}
${request.weeksUntilEvent <= 3
  ? `ATENÇÃO — PLANO CURTO: só há ${request.weeksUntilEvent} semana(s) até ao evento. Não há tempo para
ganhar forma, e tentá-lo só traria fadiga à linha de partida. Este plano é de AFINAÇÃO: mantém o
volume baixo, inclui um ou dois estímulos curtos ao ritmo de prova para o corpo o recordar, e prioriza
a chegada descansado. Nada de treinos longos nem de progressões de volume.`
  : `PRINCÍPIOS: 80% do volume em Z1-Z2; progressão máxima de 10% por semana; uma semana de recuperação
a cada 3 de carga; taper nas últimas 2 semanas; especificidade crescente até ao evento.`}

Gera as PRIMEIRAS ${request.weeksToGenerate ?? 4} SEMANAS. Para cada sessão indica APENAS os campos abaixo — sem
descrições, sem aquecimento, sem dicas. Esse detalhe é pedido depois, à parte.

sessionType: apenas EASY, TEMPO, INTERVALS, LONG, RECOVERY, STRENGTH, BRICK, SWIM ou RACE
sport: apenas RUNNING, CYCLING ou SWIMMING

Responde APENAS com JSON válido, sem markdown:
{
  "planName": "nome do plano",
  "periodization": "filosofia e fases do plano em 2-3 frases",
  "coachNotes": "nota do treinador ao atleta sobre a abordagem, 3-4 frases",
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "foco da semana numa linha",
      "coachMessage": "mensagem do treinador para a semana, 1-2 frases",
      "totalDistanceKm": 42,
      "totalDurationMin": 280,
      "sessions": [
        { "dayOfWeek": 2, "sport": "RUNNING", "sessionType": "EASY", "name": "Corrida Base Z2",
          "plannedDistanceKm": 8, "plannedDurationMin": 55, "plannedPace": "6:45/km", "isPriority": false }
      ]
    }
  ]
}`;

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Resposta inesperada da IA");
  return content.text.replace(/^```(?:json)?\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();
}

export interface SessionDetail {
  id: string;
  shortDescription: string;
  warmup: string;
  mainSet: string;
  cooldown: string;
  coachTip: string;
  rpe: string;
  keyFocus: string;
  zones?: Record<string, number>;
  /** Structure for the watch: parsing it back out of the prose loses detail. */
  steps?: Array<{ name?: string; repeat?: number; steps: Array<{ duration: string; target?: string }> }>;
}

/**
 * Fills in the prose for a batch of sessions, normally one week at a time —
 * about 7 seconds per session, so a week lands in well under a minute.
 */
export async function detailSessions(params: {
  athlete: TrainingPlanRequest["athlete"];
  event: TrainingPlanRequest["event"];
  weekFocus: string | null;
  sessions: Array<{
    id: string; name: string; sport: string; sessionType: string; dayOfWeek: number;
    plannedDistance: number | null; plannedDuration: number | null; plannedPace: string | null;
  }>;
}): Promise<SessionDetail[]> {
  const zonas = params.athlete.maxHR
    ? `Zonas de FC (FC máx ${params.athlete.maxHR}): Z1 <${Math.round(params.athlete.maxHR * 0.6)}, Z2 ${Math.round(params.athlete.maxHR * 0.6)}-${Math.round(params.athlete.maxHR * 0.7)}, Z3 ${Math.round(params.athlete.maxHR * 0.7)}-${Math.round(params.athlete.maxHR * 0.8)}, Z4 ${Math.round(params.athlete.maxHR * 0.8)}-${Math.round(params.athlete.maxHR * 0.9)}, Z5 >${Math.round(params.athlete.maxHR * 0.9)} bpm.`
    : "Sem FC máxima conhecida: usa esforço percebido (RPE 1-10) como referência.";

  // The watch guides towards whatever a step targets, and a heart-rate target
  // leaves the pace to the lap summary — after the step is over. Giving the
  // model the athlete's own pace bands lets it write paces from the start.
  const threshold = inferThresholdPace(params.athlete.ltPace ?? null, params.sessions);
  const ritmos = threshold
    ? `Ritmos de referência deste atleta (min/km): ${zonePaceTable(threshold)}.`
    : "";

  const prompt = `És um treinador de elite. Detalha cada uma destas sessões de treino.

ATLETA: ${params.athlete.name}, nível ${params.athlete.fitnessLevel}
EVENTO ALVO: ${params.event.name} — ${params.event.distance} em ${params.event.date}
${params.weekFocus ? `FOCO DA SEMANA: ${params.weekFocus}` : ""}
${zonas}
${ritmos}

SESSÕES:
${JSON.stringify(params.sessions, null, 2)}

Para cada sessão devolve o detalhe. Sê concreto e conciso — 1 a 2 frases por campo.
Quando usares um termo técnico pela primeira vez (strides, fartlek, taper, VO2max, limiar, RPE,
cadência), explica-o brevemente entre parênteses.

Inclui também "steps": a mesma sessão em estrutura, para ser enviada ao relógio.
Regras estritas para os steps, porque são lidos por uma máquina:
- duration: "10m", "5m30s", "45s", "800mtr" ou "1km". Nada mais.
- target: OBRIGATÓRIO em todos os passos. Na CORRIDA usa sempre um pace, nunca
  uma zona de FC: "5:02/km Pace" ou "5:05-4:58/km Pace" (no intervalo, o ritmo
  mais lento vem primeiro). O relógio só consegue orientar para aquilo que o
  passo define como alvo — com FC, o atleta só descobre o ritmo no resumo, já
  depois de a fase ter terminado. Isto vale para tudo: aquecimento, acelerações,
  recuperações entre séries e arrefecimento, e não só para a série principal.
  Usa os ritmos de referência acima. Na natação e no ciclismo, e só aí, mantém
  "Z1 HR" a "Z5 HR".
- Um bloco por secção. Usa "name" para "Aquecimento" e "Arrefecimento", e "repeat"
  para as séries. A série principal não precisa de "name".
- Reproduz TUDO o que escreveste no texto, incluindo acelerações e drills dentro do
  aquecimento — é aí que o atleta fica sem orientação se forem omitidos.

Responde APENAS com JSON válido, um array com um objeto por sessão, sem markdown:
[
  {
    "id": "id-da-sessão-tal-como-recebido",
    "shortDescription": "uma linha sobre o propósito da sessão",
    "warmup": "o que fazer no aquecimento",
    "mainSet": "a série principal, com estrutura e alvos",
    "cooldown": "retorno à calma e alongamentos",
    "coachTip": "conselho do treinador para esta sessão",
    "rpe": "ex: 6-7/10 — desconfortável mas sustentável",
    "keyFocus": "o aspeto técnico a trabalhar",
    "zones": { "z1": 20, "z2": 60, "z3": 20, "z4": 0, "z5": 0 },
    "steps": [
      { "name": "Aquecimento", "steps": [{ "duration": "10m", "target": "7:00-6:20/km Pace" }] },
      { "repeat": 3, "steps": [{ "duration": "80mtr", "target": "4:30/km Pace" },
                               { "duration": "45s", "target": "7:30-6:30/km Pace" }] },
      { "repeat": 5, "steps": [{ "duration": "3m", "target": "5:05-4:55/km Pace" },
                               { "duration": "2m", "target": "7:30-6:30/km Pace" }] },
      { "name": "Arrefecimento", "steps": [{ "duration": "10m", "target": "7:00-6:20/km Pace" }] }
    ]
  }
]`;

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Resposta inesperada da IA");
  const texto = content.text.replace(/^```(?:json)?\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();
  const parsed = JSON.parse(texto);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Adds the next stretch of weeks to a plan that already exists.
 *
 * Plans are built on a rolling horizon rather than in full: only the next few
 * weeks are ever materialised, and this tops them up as the athlete advances.
 * The weeks already written are summarised into the prompt so the periodisation
 * continues from where it stands instead of restarting at base building — and
 * so the taper still lands on the event rather than wherever this batch ends.
 */
export async function extendPlanSkeleton(params: {
  athlete: TrainingPlanRequest["athlete"];
  event: TrainingPlanRequest["event"];
  totalWeeks: number;
  fromWeek: number;
  toWeek: number;
  previousWeeks: Array<{ weekNumber: number; focus: string | null; totalDistanceKm: number | null }>;
}): Promise<string> {
  const historico = params.previousWeeks.length
    ? params.previousWeeks
        .map(w => `  Semana ${w.weekNumber}: ${w.focus ?? "sem foco definido"}${w.totalDistanceKm ? ` (${w.totalDistanceKm}km)` : ""}`)
        .join("\n")
    : "  (nenhuma ainda)";

  const semanasAteEvento = params.totalWeeks - params.toWeek;

  const prompt = `És um treinador de elite. Este atleta já tem um plano em curso e precisas de acrescentar as próximas semanas.

ATLETA: ${params.athlete.name}, ${params.athlete.age} anos, nível ${params.athlete.fitnessLevel}
${params.athlete.weeklyHours}h disponíveis por semana${params.athlete.maxHR ? ` | FC máxima ${params.athlete.maxHR} bpm` : ""}

EVENTO: ${params.event.name} — ${params.event.distance} em ${params.event.date}
O plano tem ${params.totalWeeks} semanas no total.

SEMANAS JÁ PLANEADAS:
${historico}

${calendarRules(params.athlete)}
${triathlonGuidance(params.event.sport)}
Gera as semanas ${params.fromWeek} a ${params.toWeek}, continuando a progressão acima — não recomeces
pela base. Depois da semana ${params.toWeek} faltarão ${semanasAteEvento} semanas até ao evento:
${semanasAteEvento <= 2
  ? "estas semanas são de TAPER, com redução de 40-50% do volume e alguma intensidade mantida."
  : semanasAteEvento <= 5
  ? "estás na fase específica — o treino deve aproximar-se do ritmo e das exigências da prova."
  : "estás em fase de construção — aumenta o volume progressivamente, no máximo 10% por semana, com uma semana de recuperação a cada 3 de carga."}

Indica APENAS os campos abaixo por sessão — sem descrições nem dicas, que são pedidas depois.
sessionType: apenas EASY, TEMPO, INTERVALS, LONG, RECOVERY, STRENGTH, BRICK, SWIM ou RACE
sport: apenas RUNNING, CYCLING ou SWIMMING

Responde APENAS com JSON válido, sem markdown:
{
  "weeks": [
    {
      "weekNumber": ${params.fromWeek},
      "focus": "foco da semana numa linha",
      "coachMessage": "mensagem do treinador para a semana, 1-2 frases",
      "totalDistanceKm": 45,
      "totalDurationMin": 300,
      "sessions": [
        { "dayOfWeek": 2, "sport": "RUNNING", "sessionType": "EASY", "name": "Corrida Base Z2",
          "plannedDistanceKm": 8, "plannedDurationMin": 55, "plannedPace": "6:45/km", "isPriority": false }
      ]
    }
  ]
}`;

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Resposta inesperada da IA");
  return content.text.replace(/^```(?:json)?\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();
}
