export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "sessionId obrigatório" }, { status: 400 });

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { week: { include: { plan: true } } },
  });

  if (!session || session.week.plan.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  const fitnessMap: Record<string, string> = {
    BEGINNER: "iniciante", INTERMEDIATE: "intermédio", ADVANCED: "avançado", ELITE: "elite",
  };

  const prompt = `Cria um plano detalhado de nutrição e hidratação para este treino:
Tipo: ${session.sessionType}, Distância: ${session.plannedDistance ?? "?"}km, Duração: ${session.plannedDuration ?? "?"}min, Pace alvo: ${session.plannedPace ?? "?"}
Nível do atleta: ${fitnessMap[athlete.fitnessLevel] ?? "intermédio"}

Inclui:
🍽️ **Refeição 2-3h antes** — o que comer, quantidades, exemplos
🍌 **Lanche 30-60min antes** — snack rápido e fácil de digerir
💧 **Durante o treino** — hidratação (ml/hora), géis, eletrólitos (se necessário)
🏁 **Recuperação imediata (15-30min após)** — janela anabólica, proteínas + hidratos
🍗 **Refeição de recuperação** — refeição completa de recuperação

Formato: secções claras com emoji, quantidades específicas, dicas práticas.
Responde em português europeu.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const plan = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ plan });
}
