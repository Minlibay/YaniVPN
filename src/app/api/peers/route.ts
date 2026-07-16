import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildClientConfig, generateWgKeyPair, nextClientIp } from "@/lib/wg";
import { buildVlessLink, generateClientUuid } from "@/lib/vless";

const createPeerSchema = z.object({
  name: z.string().min(1).max(100),
  serverId: z.string().min(1),
});

// Создаёт клиента для выбранного сервера.
// WireGuard: генерирует пару ключей и адрес в туннеле, отдаёт .conf.
// VLESS: генерирует UUID, отдаёт ссылку vless://… для импорта в приложение.
// Секреты клиента (приватный ключ WG) на сервере НЕ хранятся.
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

  if (server.protocol === "vless") {
    const uuid = generateClientUuid();
    const peer = await prisma.peer.create({
      data: { name: parsed.data.name, uuid, serverId: server.id },
    });
    const link = buildVlessLink({
      uuid,
      host: server.host,
      port: server.port,
      publicKey: server.publicKey,
      shortId: server.realityShortId,
      sni: server.realitySni,
      name: `${parsed.data.name}@${server.name}`,
    });
    return NextResponse.json(
      { id: peer.id, protocol: "vless", uuid, link, config: link },
      { status: 201 }
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
    { id: peer.id, protocol: "wireguard", publicKey: keys.publicKey, allowedIp, config },
    { status: 201 }
  );
}
