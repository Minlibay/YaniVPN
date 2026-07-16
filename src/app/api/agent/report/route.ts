import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Отчёт агента, работающего на VPN-ноде.
// Агент раз в минуту читает `wg show <iface> dump` и присылает сюда
// состояние всех пиров. Авторизация — Bearer-токен сервера (apiToken).
const reportSchema = z.object({
  peers: z.array(
    z.object({
      publicKey: z.string().min(1),
      // unix-время последнего handshake в секундах; 0 = не было
      latestHandshake: z.number().int().nonnegative(),
      rxBytes: z.number().int().nonnegative(),
      txBytes: z.number().int().nonnegative(),
    })
  ),
});

const HANDSHAKE_ACTIVE_MS = 3 * 60 * 1000;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  }

  const server = await prisma.server.findUnique({ where: { apiToken: token } });
  if (!server) {
    return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный отчёт" }, { status: 400 });
  }

  const now = new Date();
  let activePeers = 0;
  let totalRx = 0n;
  let totalTx = 0n;

  for (const p of parsed.data.peers) {
    const lastHandshakeAt = p.latestHandshake > 0 ? new Date(p.latestHandshake * 1000) : null;
    if (lastHandshakeAt && now.getTime() - lastHandshakeAt.getTime() < HANDSHAKE_ACTIVE_MS) {
      activePeers++;
    }
    totalRx += BigInt(p.rxBytes);
    totalTx += BigInt(p.txBytes);

    // Обновляем только известных панели пиров; чужие ключи игнорируем
    await prisma.peer.updateMany({
      where: { publicKey: p.publicKey, serverId: server.id },
      data: {
        lastHandshakeAt,
        rxBytes: BigInt(p.rxBytes),
        txBytes: BigInt(p.txBytes),
      },
    });
  }

  await prisma.$transaction([
    prisma.server.update({
      where: { id: server.id },
      data: { lastSeenAt: now },
    }),
    prisma.statSample.create({
      data: {
        serverId: server.id,
        activePeers,
        rxBytes: totalRx,
        txBytes: totalTx,
      },
    }),
  ]);

  // Агент получает список включённых пиров — может синхронизировать
  // конфигурацию WireGuard (добавить новых клиентов, убрать отключённых).
  const peers = await prisma.peer.findMany({
    where: { serverId: server.id, enabled: true },
    select: { publicKey: true, allowedIp: true },
  });

  return NextResponse.json({ ok: true, peers });
}
