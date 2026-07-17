export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { claude, CLAUDE_MODEL } from "@/lib/claude";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: { nutritionPlans: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  return NextResponse.json(athlete.nutritionPlans[0] ?? null);
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      user: true,
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: { event: true, weeks: { orderBy: { weekNumber: "asc" }, take: 1 } },
        take: 1,
      },
    },
  });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  if (!athlete.weightKg || !athlete.heightCm) {
    return NextResponse.json({ error: "Preenche o peso e altura no perfil primeiro." }, { status: 400 });
  }

  const plan = athlete.trainingPlans[0];
  const age = athlete.dateOfBirth
    ? Math.floor((Date.now() - new Date(athlete.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : 30;

  // Mifflin-St Jeor BMR
  const bmr = athlete.gender === "FEMALE"
    ? 10 * athlete.weightKg + 6.25 * athlete.heightCm - 5 * age - 161
    : 10 * athlete.weightKg + 6.25 * athlete.heightCm - 5 * age + 5;

  const weightGoalLabel: Record<string, string> = {
    lose: "perder peso (défice calórico moderado de ~300 kcal/dia)",
    maintain: "manter peso",
    gain: "ganhar massa muscular (excedente calórico moderado de ~200 kcal/dia)",
  };

  const prompt = `És o melhor nutricionista desportivo do mundo, especializado em corredores e triatletas. Cria um plano nutricional completo e personalizado para este atleta.

═══════════════════════════════════════════
PERFIL DO ATLETA
═══════════════════════════════════════════
Nome: ${athlete.user.name}
Idade: ${age} anos | Género: ${athlete.gender === "FEMALE" ? "Feminino" : "Masculino"}
Peso: ${athlete.weightKg} kg | Altura: ${athlete.heightCm} cm
IMC: ${(athlete.weightKg / Math.pow(athlete.heightCm / 100, 2)).toFixed(1)}
TMB (Mifflin-St Jeor): ${Math.round(bmr)} kcal/dia
Nível: ${athlete.fitnessLevel}
Horas de treino/semana: ${athlete.weeklyHours ?? 5}h
Objetivo de peso: ${weightGoalLabel[athlete.weightGoal ?? "maintain"]}
Restrições alimentares: ${athlete.dietaryRestrictions || "nenhuma"}

${plan ? `═══════════════════════════════════════════
PLANO DE TREINO ATIVO
═══════════════════════════════════════════
Evento: ${plan.event.name} (${plan.event.distance})
Data da prova: ${plan.event.date.toISOString().split("T")[0]}
Semanas até à prova: ${Math.ceil((plan.event.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))}` : ""}

═══════════════════════════════════════════
INSTRUÇÃO
═══════════════════════════════════════════
Cria um plano nutricional detalhado com:
1. Calorias diárias (dias de treino vs descanso)
2. Macronutrientes em gramas (hidratos, proteína, gordura)
3. Distribuição de refeições ao longo do dia
4. Nutrição pré-treino, durante e pós-treino
5. Hidratação diária e durante o treino
6. Alimentos recomendados e a evitar
7. Estratégia por fase do plano (base, construção, taper, prova)
8. Suplementação básica recomendada

Quando usares termos técnicos (glicogénio, periodização, janela anabólica, etc.), explica-os brevemente entre parênteses.

Responde APENAS com JSON válido:
{
  "summary": "resumo executivo do plano em 2-3 frases",
  "calories": {
    "restDay": 2100,
    "trainingDay": 2600,
    "longRunDay": 2900,
    "raceWeek": 3100
  },
  "macros": {
    "restDay": { "carbsG": 220, "proteinG": 140, "fatG": 70 },
    "trainingDay": { "carbsG": 300, "proteinG": 150, "fatG": 75 },
    "longRunDay": { "carbsG": 380, "proteinG": 155, "fatG": 80 },
    "raceWeek": { "carbsG": 430, "proteinG": 150, "fatG": 75 }
  },
  "mealPlan": {
    "restDay": [
      { "meal": "Pequeno-almoço", "time": "07:30", "description": "...", "kcal": 450 },
      { "meal": "Almoço", "time": "12:30", "description": "...", "kcal": 650 },
      { "meal": "Lanche", "time": "16:00", "description": "...", "kcal": 250 },
      { "meal": "Jantar", "time": "19:30", "description": "...", "kcal": 700 }
    ],
    "trainingDay": [
      { "meal": "Pequeno-almoço", "time": "07:00", "description": "...", "kcal": 500 },
      { "meal": "Pré-treino", "time": "10:00", "description": "...", "kcal": 200 },
      { "meal": "Pós-treino", "time": "12:30", "description": "...", "kcal": 500 },
      { "meal": "Almoço", "time": "13:30", "description": "...", "kcal": 600 },
      { "meal": "Lanche", "time": "16:30", "description": "...", "kcal": 300 },
      { "meal": "Jantar", "time": "20:00", "description": "...", "kcal": 700 }
    ]
  },
  "duringTraining": {
    "under60min": "descrição do que tomar durante treinos até 60min",
    "60to90min": "descrição para 60-90 minutos",
    "over90min": "descrição para mais de 90 minutos com quantidades de géis/carboidratos"
  },
  "hydration": {
    "daily": "quantidade e estratégia de hidratação diária",
    "training": "hidratação durante o treino por hora",
    "race": "estratégia de hidratação na prova"
  },
  "phases": [
    { "phase": "Base Aeróbica", "focus": "...", "nutritionTip": "..." },
    { "phase": "Construção", "focus": "...", "nutritionTip": "..." },
    { "phase": "Taper", "focus": "...", "nutritionTip": "..." },
    { "phase": "Semana da Prova", "focus": "...", "nutritionTip": "..." },
    { "phase": "Dia da Prova", "focus": "...", "nutritionTip": "..." }
  ],
  "foods": {
    "recommended": ["alimento 1 — porquê", "alimento 2 — porquê"],
    "avoid": ["alimento 1 — porquê", "alimento 2 — porquê"]
  },
  "supplements": [
    { "name": "nome", "dose": "dose", "timing": "quando tomar", "reason": "porquê" }
  ],
  "coachNote": "nota pessoal do nutricionista ao atleta"
}`;

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Resposta inesperada");
  const text = content.text.replace(/^```(?:json)?\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();
  const planContent = JSON.parse(text);

  // Apaga plano anterior e cria novo
  await prisma.nutritionPlan.deleteMany({ where: { athleteId: athlete.id } });
  const nutritionPlan = await prisma.nutritionPlan.create({
    data: {
      athleteId: athlete.id,
      planId: plan?.id ?? null,
      content: planContent,
    },
  });

  return NextResponse.json(nutritionPlan, { status: 201 });
}
