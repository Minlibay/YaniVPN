import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildClientConfig, generateWgKeyPair, nextClientIp } from "@/lib/wg";

const createPeerSchema = z.object({
  name: z.string().min(1).max(100),
  serverId: z.string().min(1),
});

// Создаёт клиента: генерирует пару ключей WireGuard, выделяет адрес
// в туннельной подсети и возвращает готовый клиентский конфиг.
// Приватный ключ клиента НЕ сохраняется — только отдаётся в ответе.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createPeerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const server = await prisma.server.findUnique({
    where: { id: parsed.data.serverId },
    include: { peers: { select: { allowedIp: true } } },
  });
  if (!server) {
    return NextResponse.json({ error: "Сервер не найден" }, { status: 404 });
  }
  if (server.status !== "active" || !server.publicKey) {
    return NextResponse.json(
      { error: "Сервер ещё не настроен — дождитесь окончания установки" },
      { status: 409 }
    );
  }

  const keys = generateWgKeyPair();
  const allowedIp = nextClientIp(server.peers.map((p) => p.allowedIp));

  const peer = await prisma.peer.create({
    data: {
      name: parsed.data.name,
      publicKey: keys.publicKey,
      allowedIp,
      serverId: server.id,
    },
  });

  const config = buildClientConfig({
    clientPrivateKey: keys.privateKey,
    clientAddress: allowedIp,
    serverPublicKey: server.publicKey,
    serverHost: server.host,
    serverPort: server.port,
  });

  return NextResponse.json(
    { id: peer.id, publicKey: keys.publicKey, allowedIp, config },
    { status: 201 }
  );
}
