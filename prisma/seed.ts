import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateKeyPairSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

function wgKey(): string {
  const { publicKey } = generateKeyPairSync("x25519");
  return Buffer.from(publicKey.export({ type: "spki", format: "der" }).subarray(-32)).toString(
    "base64"
  );
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@yanivpn.local";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";

  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Администратор",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  console.log(`Админ: ${email} / ${password}`);

  if ((await prisma.server.count()) > 0) {
    console.log("Серверы уже есть — демо-данные не создаю.");
    return;
  }

  // Демо-серверы и клиенты, чтобы дашборд не был пустым.
  // Удалите их и добавьте реальные ноды через панель.
  const serversData = [
    { name: "Amsterdam-1", host: "185.10.20.30", country: "NL", city: "Амстердам" },
    { name: "Frankfurt-1", host: "185.40.50.60", country: "DE", city: "Франкфурт" },
    { name: "Helsinki-1", host: "95.216.10.20", country: "FI", city: "Хельсинки" },
  ];

  const now = Date.now();
  for (const [si, s] of serversData.entries()) {
    const server = await prisma.server.create({
      data: {
        ...s,
        publicKey: wgKey(),
        apiToken: randomBytes(32).toString("hex"),
        // первые два сервера "онлайн", третий давно молчит
        lastSeenAt: si < 2 ? new Date(now - 30_000) : new Date(now - 3600_000),
      },
    });

    const peerCount = 4 + si * 2;
    let rxBase = 0n;
    let txBase = 0n;
    for (let i = 0; i < peerCount; i++) {
      const online = i % 3 !== 0;
      rxBase = BigInt(Math.floor(Math.random() * 8e9));
      txBase = BigInt(Math.floor(Math.random() * 3e10));
      await prisma.peer.create({
        data: {
          name: `client-${si + 1}-${i + 1}`,
          publicKey: wgKey(),
          allowedIp: `10.8.0.${i + 2}/32`,
          serverId: server.id,
          enabled: i !== 1,
          lastHandshakeAt: online
            ? new Date(now - Math.random() * 120_000)
            : new Date(now - (3600_000 + Math.random() * 86400_000)),
          rxBytes: rxBase,
          txBytes: txBase,
        },
      });
    }

    // Точки статистики за последние 24 часа с шагом 15 минут
    const samples = [];
    let rx = BigInt(Math.floor(Math.random() * 5e9));
    let tx = BigInt(Math.floor(Math.random() * 2e10));
    for (let t = 24 * 4; t >= 0; t--) {
      const hourOfDay = new Date(now - t * 15 * 60_000).getHours();
      // имитируем суточный профиль нагрузки: пик вечером
      const load = 0.3 + 0.7 * Math.max(0, Math.sin(((hourOfDay - 6) / 24) * Math.PI * 2));
      rx += BigInt(Math.floor((2e7 + Math.random() * 8e7) * load));
      tx += BigInt(Math.floor((8e7 + Math.random() * 3e8) * load));
      samples.push({
        serverId: server.id,
        activePeers: Math.max(0, Math.round(peerCount * load * (0.6 + Math.random() * 0.4))),
        rxBytes: rx,
        txBytes: tx,
        sampledAt: new Date(now - t * 15 * 60_000),
      });
    }
    await prisma.statSample.createMany({ data: samples });
  }

  console.log("Демо-данные созданы: 3 сервера, клиенты и статистика за сутки.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
