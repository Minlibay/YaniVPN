import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updatePeerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
});

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const body = await req.json().catch(() => null);
  const parsed = updatePeerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  try {
    await prisma.peer.update({ where: { id: params.id }, data: parsed.data });
  } catch {
    return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await prisma.peer.delete({ where: { id: params.id } });
  } catch {
    return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
