import { prisma } from "@/lib/db";
import { countryFlag, formatBytes, formatRelative, isOnline, ONLINE_THRESHOLD_MS } from "@/lib/format";
import { AddServerButton } from "@/components/AddServerButton";
import { ServerActions } from "@/components/ServerActions";
import { AutoRefresh } from "@/components/AutoRefresh";

function ProtocolBadge({ protocol }: { protocol: string }) {
  const vless = protocol === "vless";
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
        vless ? "bg-[#008300]/15 text-emerald-400" : "bg-[#3987e5]/15 text-[#7db4f0]"
      }`}
      title={vless ? "VLESS + Reality — обход блокировок" : "WireGuard"}
    >
      {vless ? "VLESS" : "WireGuard"}
    </span>
  );
}

function StatusBadge({ status, online }: { status: string; online: boolean }) {
  if (status === "installing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[#7db4f0]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3987e5]" /> установка…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> ошибка
      </span>
    );
  }
  return online ? (
    <span className="inline-flex items-center gap-1.5 text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> онлайн
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> офлайн
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const activeSince = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  const servers = await prisma.server.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      peers: { select: { rxBytes: true, txBytes: true, lastHandshakeAt: true } },
    },
  });

  const installing = servers.some((s) => s.status === "installing");

  return (
    <div>
      {installing && <AutoRefresh />}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Серверы</h1>
        <AddServerButton />
      </div>

      <section className="rounded-xl border border-surface-border bg-surface-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">Сервер</th>
              <th className="px-5 py-3 font-medium">Протокол</th>
              <th className="px-5 py-3 font-medium">Адрес</th>
              <th className="px-5 py-3 font-medium">Статус</th>
              <th className="px-5 py-3 font-medium">Активные</th>
              <th className="px-5 py-3 font-medium">Трафик всего</th>
              <th className="px-5 py-3 font-medium">Последний отчёт</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => {
              const active = s.peers.filter(
                (p) => p.lastHandshakeAt && p.lastHandshakeAt >= activeSince
              ).length;
              const traffic = s.peers.reduce((acc, p) => acc + p.rxBytes + p.txBytes, 0n);
              return (
                <tr key={s.id} className="border-t border-surface-border/60">
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className="mr-2">{countryFlag(s.country)}</span>
                    <span className="font-medium">{s.name}</span>
                    {s.city && <span className="ml-2 text-xs text-slate-500">{s.city}</span>}
                  </td>
                  <td className="px-5 py-3">
                    <ProtocolBadge protocol={s.protocol} />
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">
                    {s.host}:{s.port}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={s.status} online={isOnline(s.lastSeenAt)} />
                  </td>
                  <td className="px-5 py-3 tabular-nums">
                    {active} / {s.peers.length}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{formatBytes(traffic)}</td>
                  <td className="px-5 py-3 text-slate-400">{formatRelative(s.lastSeenAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <ServerActions
                      serverId={s.id}
                      serverName={s.name}
                      apiToken={s.apiToken}
                      status={s.status}
                      provisionError={s.provisionError}
                    />
                  </td>
                </tr>
              );
            })}
            {servers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                  Серверов пока нет. Нажмите «Добавить сервер», чтобы подключить первую ноду.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="mt-4 text-xs text-slate-500">
        Сервер считается онлайн, если его агент отправлял статистику за последние 3 минуты.
        Настройка агента описана в{" "}
        <a
          href="https://github.com/minlibay/yanivpn/blob/main/agent/README.md"
          className="text-[#7db4f0] hover:underline"
        >
          agent/README.md
        </a>
        .
      </p>
    </div>
  );
}
