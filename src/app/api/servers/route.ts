import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateApiToken } from "@/lib/wg";

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535).default(51820),
  country: z.string().length(2),
  city: z.string().max(100).default(""),
  publicKey: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const server = await prisma.server.create({
    data: {
      ...parsed.data,
      country: parsed.data.country.toUpperCase(),
      apiToken: generateApiToken(),
    },
  });

  // apiToken показываем один раз при создании — его нужно прописать агенту ноды
  return NextResponse.json({ id: server.id, apiToken: server.apiToken }, { status: 201 });
}
