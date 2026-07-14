import Anthropic from "@anthropic-ai/sdk";

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
    longRunDay?: number; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
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

function getZonesForAthlete(maxHR?: number, ltPace?: string, ftp?: number): string {
  if (maxHR) {
    return `
ZONAS DE FC DO ATLETA (baseadas em FC máx ${maxHR} bpm):
- Z1 (Recuperação ativa): < ${Math.round(maxHR * 0.60)} bpm
- Z2 (Base aeróbica/MAF): ${Math.round(maxHR * 0.60)}–${Math.round(maxHR * 0.70)} bpm
- Z3 (Aeróbico moderado): ${Math.round(maxHR * 0.70)}–${Math.round(maxHR * 0.80)} bpm
- Z4 (Limiar anaeróbio): ${Math.round(maxHR * 0.80)}–${Math.round(maxHR * 0.90)} bpm
- Z5 (VO2max/Neuro): > ${Math.round(maxHR * 0.90)} bpm`;
  }
  return `ZONAS: Usa zonas padrão baseadas em % de esforço percebido (RPE 1-10).`;
}

export async function generateTrainingPlan(request: TrainingPlanRequest): Promise<string> {
  const zonesInfo = getZonesForAthlete(request.athlete.maxHR, request.athlete.ltPace, request.athlete.ftp);

  const fitnessDescriptions: Record<string, string> = {
    BEGINNER: "iniciante (menos de 1 ano de treino regular, base aeróbica fraca, prioritizar adaptação)",
    INTERMEDIATE: "intermédio (1–3 anos de treino, boa base aeróbica, pode tolerar volume moderado e alguma intensidade)",
    ADVANCED: "avançado (3–7 anos, competições regulares, tolera alto volume e intensidade, conhece o próprio corpo)",
    ELITE: "elite (alto rendimento, +7 anos, treina 10–20h/semana, periodização complexa com duplas sessões)",
  };

  const prompt = `És o melhor treinador de corrida e triatlo do mundo — uma fusão dos métodos de Jack Daniels, Arthur Lydiard, Joe Friel, Matt Fitzgerald e Bob Bowman. Tens décadas de experiência a preparar atletas olímpicos e recordistas mundiais. A tua missão é criar um plano de treino de NÍVEL ELITE personalizado.

═══════════════════════════════════════════
PERFIL DO ATLETA
═══════════════════════════════════════════
Nome: ${request.athlete.name}
Idade: ${request.athlete.age} anos | Género: ${request.athlete.gender}
Nível: ${fitnessDescriptions[request.athlete.fitnessLevel] ?? request.athlete.fitnessLevel}
Volume semanal disponível: ${request.athlete.weeklyHours} horas
FC repouso: ${request.athlete.restingHR ?? "não fornecida"} bpm
FC máxima: ${request.athlete.maxHR ?? "não fornecida"} bpm
Pace de limiar (corrida): ${request.athlete.ltPace ?? "não fornecido"}
FTP (ciclismo): ${request.athlete.ftp ?? "não fornecido"} watts

${zonesInfo}

═══════════════════════════════════════════
EVENTO ALVO
═══════════════════════════════════════════
Evento: ${request.event.name}
Modalidade: ${request.event.sport} | Distância: ${request.event.distance}
Data: ${request.event.date}
Objetivo: ${request.event.goalType}${request.event.goalTime ? ` em ${request.event.goalTime}` : ""}

Data atual: ${request.currentDate}
Semanas disponíveis: ${request.weeksUntilEvent}

═══════════════════════════════════════════
PRINCÍPIOS OBRIGATÓRIOS A APLICAR
═══════════════════════════════════════════
1. DISTRIBUIÇÃO 80/20: 80% do volume em Z1-Z2 (aeróbico fácil), 20% em Z3-Z5
2. PROGRESSÃO CONSERVADORA: nunca aumentar volume >10% por semana
3. SEMANA DE RECUPERAÇÃO: a cada 3 semanas de carga, 1 semana com -30% volume
4. ESPECIFICIDADE CRESCENTE: primeiras semanas = base aeróbica; semanas finais = simulação de corrida
5. TAPER: últimas 2 semanas com redução de 40-50% do volume, manter alguma intensidade
6. INDIVIDUALIZAÇÃO: adaptar ao nível e horas disponíveis do atleta
7. QUALIDADE SOBRE QUANTIDADE: cada sessão tem um propósito fisiológico claro

═══════════════════════════════════════════
TIPOS DE SESSÃO E PROPÓSITO FISIOLÓGICO
═══════════════════════════════════════════
- EASY: Corrida fácil Z1-Z2, desenvolve base aeróbica, recuperação ativa, mitocôndrias
- LONG: Longo semanal Z1-Z2, desenvolve resistência, economia de glicogénio, capilarização
- TEMPO: Ritmo de limiar anaeróbio (Z4), 20-40min contínuos ou 2x20min, aumenta LT
- INTERVALS: Repetições VO2max (Z5), 3-8x3-5min, aumenta VO2max e potência
- RECOVERY: Recuperação ativa pós-treino intenso, <30min, Z1 apenas
- STRENGTH: Força específica, strides, colinas, drills de corrida
- BRICK: Específico triatlo, ciclismo seguido de corrida
- SWIM: Natação (para triatlo)

═══════════════════════════════════════════
RESTRIÇÕES DE CALENDÁRIO — REGRAS ABSOLUTAS
═══════════════════════════════════════════
ATENÇÃO: Estas regras são INVIOLÁVEIS. Conta sempre as sessões antes de gerar a resposta.

REGRA 1 — NÚMERO DE SESSÕES: Cada semana deve ter EXATAMENTE ${request.athlete.trainingDaysPerWeek ?? 5} sessões. Não ${(request.athlete.trainingDaysPerWeek ?? 5) + 1}, não ${(request.athlete.trainingDaysPerWeek ?? 5) - 1}. EXATAMENTE ${request.athlete.trainingDaysPerWeek ?? 5}.

REGRA 2 — DIA DO TREINO LONGO: O tipo LONG vai OBRIGATORIAMENTE em dayOfWeek=${request.athlete.longRunDay !== undefined ? (request.athlete.longRunDay === 0 ? 7 : request.athlete.longRunDay) : 7} (${request.athlete.longRunDay !== undefined ? ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"][request.athlete.longRunDay] : "Domingo"}).

REGRA 3 — DIAS CONSECUTIVOS: NUNCA colocar INTERVALS ou TEMPO em dias seguidos. NUNCA colocar LONG no dia a seguir a INTERVALS ou TEMPO.

REGRA 4 — CALENDÁRIO: dayOfWeek usa 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado, 7=Domingo. A semana começa na Segunda (1) e termina no Domingo (7).

═══════════════════════════════════════════
INSTRUÇÃO DE GERAÇÃO
═══════════════════════════════════════════
Gera as PRIMEIRAS 4 SEMANAS do plano com MÁXIMO DETALHE.
Cada sessão deve ter orientações completas de um treinador de elite.

REGRAS ESTRITAS para os valores:
- sessionType: APENAS um destes valores exatos: EASY, TEMPO, INTERVALS, LONG, RECOVERY, STRENGTH, BRICK, SWIM, RACE
- sport: APENAS um destes valores exatos: RUNNING, CYCLING, SWIMMING

INSTRUÇÃO SOBRE TERMINOLOGIA: Nos campos de texto (warmup, mainSet, cooldown, coachTip, keyFocus, coachMessage, coachNotes, periodization), quando usares termos técnicos desportivos pela primeira vez (ex: drills, strides, fartlek, brick, taper, VO2max, LT, RPE, cadência, MAF, intervalos, repetiçoes, Z1/Z2/Z3/Z4/Z5, etc.), adiciona sempre uma breve explicação entre parênteses. Exemplo: "strides (acelerações curtas de 20-30 segundos para trabalhar a mecânica de corrida a ritmo rápido)".

INSTRUÇÃO SOBRE PRIORIDADE (isPriority):
- Marca "isPriority": true nas sessões mais importantes da semana — aquelas que o atleta DEVE fazer para que o plano funcione.
- Regras:
  • LONG → quase sempre prioritário (é a sessão âncora da semana aeróbica)
  • TEMPO ou INTERVALS → prioritário quando é o estímulo principal de intensidade da semana (máximo 1 por semana)
  • BRICK → prioritário em planos de triatlo
  • EASY, RECOVERY, STRENGTH, SWIM de volume baixo → nunca prioritários
- Máximo 2 sessões prioritárias por semana (semanas de recuperação: máximo 1 ou nenhuma).
- Nas semanas de taper (últimas 2), marcar apenas a sessão de ritmo de corrida como prioritária.

Responde APENAS com JSON válido, sem texto antes ou depois, sem markdown:

{
  "planName": "nome do plano",
  "periodization": "descrição da periodização em 2-3 frases explicando a filosofia e fases do plano",
  "coachNotes": "nota pessoal do treinador ao atleta sobre a abordagem e o que esperar. Quando usares termos técnicos (drills, strides, fartlek, taper, VO2max, LT, RPE, brick, etc.), explica-os brevemente entre parênteses na primeira vez que os uses.",
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "foco da semana (ex: Base Aeróbica — Construção de Motor)",
      "totalDistanceKm": 42,
      "totalDurationMin": 280,
      "coachMessage": "mensagem motivacional e técnica do treinador para esta semana",
      "sessions": [
        {
          "dayOfWeek": 1,
          "sport": "RUNNING",
          "sessionType": "EASY",
          "name": "Corrida Base Z2",
          "shortDescription": "Corrida aeróbica fácil para construir base",
          "warmup": "10min caminhada/corrida muito leve Z1 (zona 1 — esforço muito fácil, conversação fluida). 4x30s aceleração progressiva com 1min recuperação.",
          "mainSet": "35min corrida contínua Z2 (conversa confortável, consegues falar em frases completas). Pace: 6:30-7:00/km ou FC 130-140bpm.",
          "cooldown": "5min caminhada, 5min alongamentos dinâmicos: quadriceps, gémeos, iliotibial.",
          "coachTip": "O teu ego vai querer ir mais rápido — não o faças. Estes treinos lentos constroem o motor aeróbico que te vai fazer voar na corrida.",
          "rpe": "4-5/10 — deves conseguir manter uma conversa sem dificuldade",
          "keyFocus": "Cadência acima de 170 passos/min, queda suave do pé sob o centro de gravidade",
          "plannedDistanceKm": 8,
          "plannedDurationMin": 55,
          "plannedPace": "6:45/km",
          "zones": { "z1": 15, "z2": 75, "z3": 10, "z4": 0, "z5": 0 },
          "isPriority": false
        }
      ]
    }
  ]
}`;

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Resposta inesperada da IA");
  const text = content.text;
  const cleaned = text.replace(/^```(?:json)?\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();
  return cleaned;
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
