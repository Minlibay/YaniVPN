import { prisma } from "@/lib/db";
import { formatBytes, isOnline, ONLINE_THRESHOLD_MS, countryFlag } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { TrafficChart } from "@/components/TrafficChart";
import { ConnectionsChart } from "@/components/ConnectionsChart";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Bucket = { t: number; rx: number; tx: number; conns: number };

// Сводит срезы статистики всех серверов в 15-минутные корзины за 24 часа:
// трафик — как дельта накопительных счётчиков, подключения — суммой по серверам.
function buildBuckets(
  samples: { serverId: string; activePeers: number; rxBytes: bigint; txBytes: bigint; sampledAt: Date }[]
): Bucket[] {
  const STEP = 15 * 60 * 1000;
  const bucketOf = (d: Date) => Math.floor(d.getTime() / STEP) * STEP;

  const byServer = new Map<string, typeof samples>();
  for (const s of samples) {
    const list = byServer.get(s.serverId) ?? [];
    list.push(s);
    byServer.set(s.serverId, list);
  }

  const buckets = new Map<number, Bucket>();
  const ensure = (t: number) => {
    let b = buckets.get(t);
    if (!b) {
      b = { t, rx: 0, tx: 0, conns: 0 };
      buckets.set(t, b);
    }
    return b;
  };

  for (const list of Array.from(byServer.values())) {
    list.sort((a, b) => a.sampledAt.getTime() - b.sampledAt.getTime());
    // подключения: в корзину идёт последний срез сервера в этой корзине
    const connsByBucket = new Map<number, number>();
    for (const s of list) connsByBucket.set(bucketOf(s.sampledAt), s.activePeers);
    for (const [t, conns] of Array.from(connsByBucket.entries())) ensure(t).conns += conns;
    // трафик: дельта между соседними срезами (счётчики накопительные)
    for (let i = 1; i < list.length; i++) {
      const rxDelta = Number(list[i].rxBytes - list[i - 1].rxBytes);
      const txDelta = Number(list[i].txBytes - list[i - 1].txBytes);
      const b = ensure(bucketOf(list[i].sampledAt));
      if (rxDelta > 0) b.rx += rxDelta;
      if (txDelta > 0) b.tx += txDelta;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
}

export default async function DashboardPage() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeSince = new Date(Date.now() - ONLINE_THRESHOLD_MS);

  const [servers, totalClients, activeConnections, samples] = await Promise.all([
    prisma.server.findMany({ include: { _count: { select: { peers: true } } } }),
    prisma.peer.count(),
    prisma.peer.count({ where: { lastHandshakeAt: { gte: activeSince } } }),
    prisma.statSample.findMany({
      where: { sampledAt: { gte: since } },
      orderBy: { sampledAt: "asc" },
    }),
  ]);

  const online = servers.filter((s) => isOnline(s.lastSeenAt));
  const buckets = buildBuckets(samples);
  const traffic24h = buckets.reduce((acc, b) => acc + b.rx + b.tx, 0);

  // активные подключения по серверам — для таблицы под графиками
  const peersByServer = await prisma.peer.groupBy({
    by: ["serverId"],
    where: { lastHandshakeAt: { gte: activeSince } },
    _count: true,
  });
  const activeByServer = new Map(peersByServer.map((p) => [p.serverId, p._count]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Дашборд</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Серверы онлайн"
          value={`${online.length} / ${servers.length}`}
          tone={online.length === servers.length ? "good" : "warn"}
        />
        <StatCard label="Активные подключения" value={String(activeConnections)} />
        <StatCard label="Всего клиентов" value={String(totalClients)} />
        <StatCard label="Трафик за 24 часа" value={formatBytes(traffic24h)} />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-surface-border bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-400">Трафик за 24 часа</h2>
          <TrafficChart data={buckets.map(({ t, rx, tx }) => ({ t, rx, tx }))} />
        </section>
        <section className="rounded-xl border border-surface-border bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-400">
            Активные подключения за 24 часа
          </h2>
          <ConnectionsChart data={buckets.map(({ t, conns }) => ({ t, conns }))} />
        </section>
      </div>

      <section className="rounded-xl border border-surface-border bg-surface-raised">
        <h2 className="border-b border-surface-border px-5 py-4 text-sm font-medium text-slate-400">
          Серверы
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">Сервер</th>
              <th className="px-5 py-3 font-medium">Статус</th>
              <th className="px-5 py-3 font-medium">Активные</th>
              <th className="px-5 py-3 font-medium">Клиенты</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => (
              <tr key={s.id} className="border-t border-surface-border/60">
                <td className="px-5 py-3">
                  <Link href="/servers" className="hover:text-[#7db4f0]">
                    <span className="mr-2">{countryFlag(s.country)}</span>
                    {s.name}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  {isOnline(s.lastSeenAt) ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> онлайн
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> офлайн
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 tabular-nums">{activeByServer.get(s.id) ?? 0}</td>
                <td className="px-5 py-3 tabular-nums">{s._count.peers}</td>
              </tr>
            ))}
            {servers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                  Серверов пока нет —{" "}
                  <Link href="/servers" className="text-[#7db4f0] hover:underline">
                    добавьте первый
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
