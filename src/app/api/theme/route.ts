export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const VALID_THEMES = ['dark', 'dim', 'light'];

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { theme } = body;
  if (!VALID_THEMES.includes(theme)) {
    return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
  }

  await prisma.athlete.update({
    where: { userId },
    data: { theme },
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    select: { theme: true },
  });

  return NextResponse.json({ theme: athlete?.theme || 'dark' });
}
