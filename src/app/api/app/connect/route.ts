import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accountFromRequest, accountUsage } from "@/lib/account";
import { buildClientConfig, nextClientIp } from "@/lib/wg";
import { buildVlessLink, buildVlessWsLink, generateClientUuid, pickShortId } from "@/lib/vless";
import { buildAmneziaClientConfig, parseAwgParams } from "@/lib/awg";

const schema = z.object({
  serverId: z.string().min(1),
  // WireGuard: публичный ключ клиента (приватный остаётся на устройстве)
  clientPublicKey: z.string().min(1).max(100).optional(),
});

// Выдаёт конфигурацию подключения аккаунта к серверу.
// Один пир на пару (аккаунт, сервер): переподключение переиспользует его.
// Квота (2 ГБ на free) проверяется перед выдачей; при исчерпании — 402,
// а действующие пиры аккаунта отключаются, чтобы туннели упали при синхронизации.
export async function POST(req: NextRequest) {
  const account = await accountFromRequest(req);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const usage = await accountUsage(account);
  if (usage.exhausted) {
    await prisma.peer.updateMany({
      where: { accountId: account.id, enabled: true },
      data: { enabled: false },
    });
    return NextResponse.json(
      { error: "Лимит трафика исчерпан", code: "quota_exceeded", ...usage },
      { status: 402 }
    );
  }

  const server = await prisma.server.findUnique({
    where: { id: parsed.data.serverId },
    include: { peers: { select: { allowedIp: true } } },
  });
  if (!server || server.status !== "active" || !server.publicKey) {
    return NextResponse.json({ error: "Сервер недоступен" }, { status: 404 });
  }

  const existing = await prisma.peer.findFirst({
    where: { accountId: account.id, serverId: server.id },
  });

  if (server.protocol === "vless") {
    const uuid = existing?.uuid ?? generateClientUuid();
    if (existing) {
      await prisma.peer.update({ where: { id: existing.id }, data: { enabled: true } });
    } else {
      await prisma.peer.create({
        data: { name: `app-${account.code.slice(-4)}`, uuid, serverId: server.id, accountId: account.id },
      });
    }
    // ws (за CDN) — ссылка на домен; reality — прямое подключение с short id.
    const link =
      server.vlessTransport === "ws"
        ? buildVlessWsLink({
            uuid,
            domain: server.vlessDomain,
            path: server.vlessPath,
            name: `YaniVPN@${server.name}`,
          })
        : buildVlessLink({
            uuid,
            host: server.host,
            port: server.port,
            publicKey: server.publicKey,
            shortId: pickShortId(server.realityShortId), // случайный из пула ноды
            sni: server.realitySni,
            name: `YaniVPN@${server.name}`,
          });
    return NextResponse.json({ protocol: "vless", link });
  }

  // WireGuard / AmneziaWG: устройство генерирует пару ключей и присылает публичный.
  if (!parsed.data.clientPublicKey) {
    return NextResponse.json(
      { error: "Для WireGuard нужен публичный ключ клиента" },
      { status: 400 }
    );
  }
  const allowedIp = existing?.allowedIp || nextClientIp(server.peers.map((p) => p.allowedIp));
  if (existing) {
    await prisma.peer.update({
      where: { id: existing.id },
      data: { publicKey: parsed.data.clientPublicKey, allowedIp, enabled: true },
    });
  } else {
    await prisma.peer.create({
      data: {
        name: `app-${account.code.slice(-4)}`,
        publicKey: parsed.data.clientPublicKey,
        allowedIp,
        serverId: server.id,
        accountId: account.id,
      },
    });
  }

  // AmneziaWG: тот же обмен ключами WG, но конфиг содержит блок обфускации.
  if (server.protocol === "awg") {
    const params = parseAwgParams(server.awgParams);
    if (!params) {
      return NextResponse.json({ error: "Сервер настроен некорректно" }, { status: 500 });
    }
    return NextResponse.json({
      protocol: "awg",
      address: allowedIp,
      serverPublicKey: server.publicKey,
      endpoint: `${server.host}:${server.port}`,
      dns: "10.8.0.1",
      configTemplate: buildAmneziaClientConfig({
        clientPrivateKey: "%PRIVATE_KEY%",
        clientAddress: allowedIp,
        serverPublicKey: server.publicKey,
        serverHost: server.host,
        serverPort: server.port,
        params,
      }),
    });
  }

  // Устройство соберёт полный .conf локально, добавив свой приватный ключ.
  return NextResponse.json({
    protocol: "wireguard",
    address: allowedIp,
    serverPublicKey: server.publicKey,
    endpoint: `${server.host}:${server.port}`,
    dns: "1.1.1.1, 8.8.8.8",
    configTemplate: buildClientConfig({
      clientPrivateKey: "%PRIVATE_KEY%",
      clientAddress: allowedIp,
      serverPublicKey: server.publicKey,
      serverHost: server.host,
      serverPort: server.port,
    }),
  });
}
