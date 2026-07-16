import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).max(255).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  country: z.string().length(2).optional(),
  city: z.string().max(100).optional(),
  publicKey: z.string().min(1).max(100).optional(),
});

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const body = await req.json().catch(() => null);
  const parsed = updateServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  try {
    await prisma.server.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        country: parsed.data.country?.toUpperCase(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Сервер не найден" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await prisma.server.delete({ where: { id: params.id } });
  } catch {
    return NextResponse.json({ error: "Сервер не найден" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
