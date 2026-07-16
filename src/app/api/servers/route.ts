import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateApiToken } from "@/lib/wg";
import { provisionServer } from "@/lib/provision";
import { panelUrlFrom, sshSchema } from "@/lib/sshInput";

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535).default(51820),
  country: z.string().length(2),
  city: z.string().max(100).default(""),
  ssh: sshSchema,
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
  const { ssh, ...data } = parsed.data;
  if (!ssh.password && !ssh.privateKey) {
    return NextResponse.json(
      { error: "Укажите SSH-пароль или приватный ключ" },
      { status: 400 }
    );
  }

  const server = await prisma.server.create({
    data: {
      ...data,
      country: data.country.toUpperCase(),
      apiToken: generateApiToken(),
      status: "installing",
    },
  });

  // Установка идёт в фоне; SSH-данные живут только в этом запросе.
  void provisionServer(
    server.id,
    { host: server.host, ...ssh },
    server.port,
    panelUrlFrom(req),
    server.apiToken
  );

  return NextResponse.json({ id: server.id, status: "installing" }, { status: 201 });
}
