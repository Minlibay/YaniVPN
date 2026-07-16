import { prisma } from "@/lib/db";
import { countryFlag, formatBytes, formatRelative, ONLINE_THRESHOLD_MS } from "@/lib/format";
import { AddClientButton } from "@/components/AddClientButton";
import { PeerActions } from "@/components/PeerActions";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const activeSince = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  const [peers, servers] = await Promise.all([
    prisma.peer.findMany({
      orderBy: { createdAt: "desc" },
      include: { server: { select: { name: true, country: true } } },
    }),
    prisma.server.findMany({ select: { id: true, name: true, country: true } }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Клиенты</h1>
        <AddClientButton
          servers={servers.map((s) => ({ id: s.id, label: `${countryFlag(s.country)} ${s.name}` }))}
        />
      </div>

      <section className="rounded-xl border border-surface-border bg-surface-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">Клиент</th>
              <th className="px-5 py-3 font-medium">Сервер</th>
              <th className="px-5 py-3 font-medium">IP в туннеле</th>
              <th className="px-5 py-3 font-medium">Статус</th>
              <th className="px-5 py-3 font-medium">Принято</th>
              <th className="px-5 py-3 font-medium">Отправлено</th>
              <th className="px-5 py-3 font-medium">Последняя активность</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {peers.map((p) => {
              const online = p.lastHandshakeAt && p.lastHandshakeAt >= activeSince;
              return (
                <tr
                  key={p.id}
                  className={`border-t border-surface-border/60 ${p.enabled ? "" : "opacity-50"}`}
                >
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-slate-400">
                    {countryFlag(p.server.country)} {p.server.name}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{p.allowedIp}</td>
                  <td className="px-5 py-3">
                    {!p.enabled ? (
                      <span className="text-slate-500">отключён</span>
                    ) : online ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> в сети
                      </span>
                    ) : (
                      <span className="text-slate-500">не в сети</span>
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{formatBytes(p.rxBytes)}</td>
                  <td className="px-5 py-3 tabular-nums">{formatBytes(p.txBytes)}</td>
                  <td className="px-5 py-3 text-slate-400">{formatRelative(p.lastHandshakeAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <PeerActions peerId={p.id} peerName={p.name} enabled={p.enabled} />
                  </td>
                </tr>
              );
            })}
            {peers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                  Клиентов пока нет. Нажмите «Добавить клиента», чтобы выпустить первый конфиг.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
