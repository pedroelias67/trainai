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

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      activities: {
        where: { sport: "RUNNING" },
        orderBy: { date: "desc" },
        take: 5,
        select: { avgPace: true, distance: true, date: true },
      },
    },
  });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const { eventId } = await req.json();
  if (!eventId) return NextResponse.json({ error: "eventId obrigatório" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  const recentActivities = athlete.activities
    .filter(a => a.avgPace)
    .map(a => `${a.distance ? (a.distance / 1000).toFixed(1) + "km" : "?"} @ ${a.avgPace}`)
    .join(", ");

  const distanceLabels: Record<string, string> = {
    FIVE_K: "5km", TEN_K: "10km", HALF_MARATHON: "Meia Maratona (21.1km)",
    MARATHON: "Maratona (42.2km)", ULTRA: "Ultra",
    SPRINT_TRIATHLON: "Triatlo Sprint", OLYMPIC_TRIATHLON: "Triatlo Olímpico",
    HALF_IRONMAN: "Half Ironman", IRONMAN: "Ironman",
  };

  const prompt = `Cria uma estratégia detalhada para o dia da corrida:
Evento: ${event.name}
Distância: ${distanceLabels[event.distance] ?? event.distance}
Objetivo: ${event.goalTime ? `Terminar em ${event.goalTime}` : "Concluir"}
Atividades recentes: ${recentActivities || "não disponível"}

Secções obrigatórias:
1️⃣ **Semana antes** — descanso, hidratação, carga de hidratos, sono
2️⃣ **Dia anterior** — rotina, refeição, material a preparar, hora de deitar
3️⃣ **Manhã da corrida** — hora de acordar, pequeno-almoço (com timing), aquecimento
4️⃣ **Estratégia de pace** — pace por km ou por secção, quando acelerar, gestão de energia
5️⃣ **Abastecimento** — quando beber, géis, eletrólitos, pontos de abastecimento
6️⃣ **Gestão mental** — o que fazer nos km difíceis, como manter o foco
7️⃣ **Pós-corrida** — recuperação imediata, refeição, cuidados

Responde em português europeu, com emojis nas secções e dicas práticas específicas para este evento.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const plan = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ plan });
}
