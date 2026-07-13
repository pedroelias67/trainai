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

  const { eventId } = await req.json();
  if (!eventId) return NextResponse.json({ error: "eventId obrigatório" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  const distanceLabels: Record<string, string> = {
    FIVE_K: "5km", TEN_K: "10km", HALF_MARATHON: "Meia Maratona (21.1km)",
    MARATHON: "Maratona (42.2km)", ULTRA: "Ultra",
    SPRINT_TRIATHLON: "Triatlo Sprint (750m nado + 20km bicicleta + 5km corrida)",
    OLYMPIC_TRIATHLON: "Triatlo Olímpico (1.5km nado + 40km bicicleta + 10km corrida)",
    HALF_IRONMAN: "Half Ironman (1.9km nado + 90km bicicleta + 21.1km corrida)",
    IRONMAN: "Ironman (3.8km nado + 180km bicicleta + 42.2km corrida)",
  };

  const isTriathlon = ["SPRINT_TRIATHLON", "OLYMPIC_TRIATHLON", "HALF_IRONMAN", "IRONMAN"].includes(event.distance);

  // Get recent activities relevant to the event type
  const recentActivities = await prisma.activity.findMany({
    where: {
      athleteId: athlete.id,
      sport: isTriathlon ? { in: ["RUNNING", "CYCLING", "SWIMMING", "TRIATHLON_SPRINT", "TRIATHLON_OLYMPIC", "TRIATHLON_HALF", "TRIATHLON_FULL"] } : "RUNNING",
    },
    orderBy: { date: "desc" },
    take: 6,
    select: { sport: true, avgPace: true, distance: true },
  });

  const recentSummary = recentActivities
    .map(a => `${a.sport}: ${a.distance ? (a.distance / 1000).toFixed(1) + "km" : "?"}${a.avgPace ? " @ " + a.avgPace : ""}`)
    .join(", ");

  const prompt = isTriathlon
    ? `Cria uma estratégia detalhada para o dia do triatlo:
Evento: ${event.name}
Distância: ${distanceLabels[event.distance] ?? event.distance}
Objetivo: ${event.goalTime ? `Terminar em ${event.goalTime}` : "Concluir"}
Atividades recentes: ${recentSummary || "não disponível"}

Secções obrigatórias:
1️⃣ **Semana antes** — descanso, hidratação, carga de hidratos, sono, revisão da bicicleta
2️⃣ **Dia anterior** — rotina, refeição rica em hidratos, material a preparar (transições), hora de deitar
3️⃣ **Manhã da prova** — hora de acordar, pequeno-almoço (timing), aquecimento, configuração das transições
4️⃣ **🏊 Natação** — estratégia de partida, pace, gestão do drafting e posicionamento
5️⃣ **T1 — Natação → Bicicleta** — o que fazer na transição, tempo alvo, sequência de ações
6️⃣ **🚴 Bicicleta** — pace/potência por secção, nutrição e hidratação durante o percurso, gestão de energia
7️⃣ **T2 — Bicicleta → Corrida** — o que fazer na transição, como lidar com as pernas pesadas
8️⃣ **🏃 Corrida** — pace de saída, como ajustar ao cansaço acumulado, estratégia para os km finais
9️⃣ **Abastecimento geral** — géis, eletrólitos, gel por hora em bicicleta e corrida, pontos de abastecimento
🔟 **Gestão mental** — como lidar com os momentos difíceis em cada disciplina
🏁 **Pós-prova** — recuperação imediata, refeição, cuidados

Quando usares termos técnicos (ex: drafting, T1, T2, brick, taper, pace, cadência, watt, FTP, etc.), adiciona uma breve explicação entre parênteses na primeira vez que os uses.
Responde em português europeu, com emojis nas secções e dicas práticas específicas para este triatlo.`
    : `Cria uma estratégia detalhada para o dia da corrida:
Evento: ${event.name}
Distância: ${distanceLabels[event.distance] ?? event.distance}
Objetivo: ${event.goalTime ? `Terminar em ${event.goalTime}` : "Concluir"}
Atividades recentes: ${recentSummary || "não disponível"}

Secções obrigatórias:
1️⃣ **Semana antes** — descanso, hidratação, carga de hidratos, sono
2️⃣ **Dia anterior** — rotina, refeição, material a preparar, hora de deitar
3️⃣ **Manhã da corrida** — hora de acordar, pequeno-almoço (com timing), aquecimento
4️⃣ **Estratégia de pace** — pace por km ou por secção, quando acelerar, gestão de energia
5️⃣ **Abastecimento** — quando beber, géis, eletrólitos, pontos de abastecimento
6️⃣ **Gestão mental** — o que fazer nos km difíceis, como manter o foco
7️⃣ **Pós-corrida** — recuperação imediata, refeição, cuidados

Quando usares termos técnicos (ex: pace, taper, strides, fartlek, VO2max, RPE, etc.), adiciona uma breve explicação entre parênteses na primeira vez que os uses.
Responde em português europeu, com emojis nas secções e dicas práticas específicas para este evento.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const plan = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ plan });
}
