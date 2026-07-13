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
      user: true,
      events: { orderBy: { date: "asc" }, take: 1 },
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: {
          event: true,
          weeks: {
            orderBy: { weekNumber: "asc" },
            take: 2,
            include: { sessions: { orderBy: { date: "asc" }, take: 14 } },
          },
        },
        take: 1,
      },
      activities: { orderBy: { date: "desc" }, take: 5 },
    },
  });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const { messages } = await req.json();

  const plan = athlete.trainingPlans[0];
  const contextString = `
Atleta: ${athlete.user.name}, ${athlete.user.createdAt ? new Date().getFullYear() - new Date(athlete.user.createdAt).getFullYear() : "??"}
Evento: ${plan?.event?.name ?? "nenhum"} em ${plan?.event?.date ? new Date(plan.event.date).toLocaleDateString("pt-PT") : "??"}
Sessões próximas: ${plan?.weeks[0]?.sessions?.slice(0, 5).map((s) => `${s.name} (${new Date(s.date).toLocaleDateString("pt-PT")}, ${s.plannedDistance ?? "?"}km)`).join("; ") ?? "nenhuma"}
Últimas atividades: ${athlete.activities.slice(0, 3).map((a) => `${a.name ?? "Atividade"} ${a.distance ? (a.distance / 1000).toFixed(1) + "km" : ""} ${a.avgPace ?? ""}`).join("; ")}
  `.trim();

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: `És o treinador pessoal de IA do TrainAI. Respondes em português europeu, de forma direta e motivante. Tens acesso ao contexto do atleta:\n${contextString}\n\nIMPORTANTE: Quando usares termos técnicos desportivos (ex: drills, strides, fartlek, brick, taper, VO2max, RPE, intervalos, LT, etc.), adiciona sempre uma breve explicação entre parênteses na primeira vez que os uses. Exemplo: "drills de corrida (exercícios técnicos para melhorar a mecânica de corrida)".`,
    messages: messages,
  });

  return NextResponse.json({
    content: response.content[0].type === "text" ? response.content[0].text : "",
  });
}
