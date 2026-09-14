import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendFeedbackEmail } from "@/lib/email";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();

    const body = await req.json();
    const { category, message } = body as { category: string; message: string };

    if (!category || !message || message.trim().length < 5) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const VALID_CATEGORIES = ["bug", "suggestion", "praise", "question"];
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Categoria inválida" }, { status: 400 });
    }

    let name = "Utilizador anónimo";
    let email = "noreply@trainai.pedroelias.com";

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      if (user) {
        name = user.name ?? name;
        email = user.email;
      }
    }

    await sendFeedbackEmail({ name, email, category, message: message.trim() });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
