import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Отчёт агента, работающего на VPN-ноде. Авторизация — Bearer-токен сервера.
// Клиент идентифицируется полем `id`: для WireGuard это публичный ключ пира,
// для VLESS — UUID клиента. `latestHandshake` шлёт только WireGuard (время
// последнего рукопожатия); для VLESS активность выводится из роста трафика.
const reportSchema = z.object({
  peers: z.array(
    z.object({
      id: z.string().min(1),
      latestHandshake: z.number().int().nonnegative().optional(),
      rxBytes: z.number().int().nonnegative(),
      txBytes: z.number().int().nonnegative(),
    })
  ),
});

const ACTIVE_MS = 3 * 60 * 1000;

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

  // Текущие пиры сервера — чтобы сопоставить отчёт и вывести активность VLESS
  // по приросту трафика (у VLESS нет аналога WG-handshake).
  const known = await prisma.peer.findMany({
    where: { serverId: server.id },
    select: { id: true, publicKey: true, uuid: true, rxBytes: true, txBytes: true },
  });
  const byIdentifier = new Map<string, (typeof known)[number]>();
  for (const p of known) {
    if (p.publicKey) byIdentifier.set(p.publicKey, p);
    if (p.uuid) byIdentifier.set(p.uuid, p);
  }

  let activePeers = 0;
  let totalRx = 0n;
  let totalTx = 0n;

  for (const r of parsed.data.peers) {
    const peer = byIdentifier.get(r.id);
    if (!peer) continue; // чужой/неизвестный клиент — игнорируем

    const rxBytes = BigInt(r.rxBytes);
    const txBytes = BigInt(r.txBytes);
    totalRx += rxBytes;
    totalTx += txBytes;

    // Данные обновления. WireGuard всегда выставляет lastHandshakeAt (в т.ч. null);
    // VLESS выставляет now только при движении трафика, иначе оставляет прежнее.
    const data: { rxBytes: bigint; txBytes: bigint; lastHandshakeAt?: Date | null } = {
      rxBytes,
      txBytes,
    };
    let activeAt: Date | null = null;

    if (r.latestHandshake !== undefined) {
      activeAt = r.latestHandshake > 0 ? new Date(r.latestHandshake * 1000) : null;
      data.lastHandshakeAt = activeAt;
    } else if (rxBytes > peer.rxBytes || txBytes > peer.txBytes) {
      activeAt = now;
      data.lastHandshakeAt = now;
    }

    if (activeAt && now.getTime() - activeAt.getTime() < ACTIVE_MS) {
      activePeers++;
    }

    await prisma.peer.update({ where: { id: peer.id }, data });
  }

  await prisma.$transaction([
    prisma.server.update({ where: { id: server.id }, data: { lastSeenAt: now } }),
    prisma.statSample.create({
      data: { serverId: server.id, activePeers, rxBytes: totalRx, txBytes: totalTx },
    }),
  ]);

  // Список включённых клиентов для синхронизации ноды.
  // WireGuard-агент использует publicKey+allowedIp, VLESS-агент — uuid.
  const peers = await prisma.peer.findMany({
    where: { serverId: server.id, enabled: true },
    select: { publicKey: true, allowedIp: true, uuid: true },
  });

  return NextResponse.json({ ok: true, peers });
}
