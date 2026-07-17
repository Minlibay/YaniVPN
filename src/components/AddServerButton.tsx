"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { SshFields, initialSsh, sshPayload, type SshForm } from "./SshFields";
import { DEFAULT_REALITY_SNI, type Protocol } from "@/lib/vless";

const initial = { name: "", host: "", port: "", country: "", city: "", sni: "", domain: "" };

export function AddServerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [protocol, setProtocol] = useState<Protocol>("wireguard");
  const [transport, setTransport] = useState<"reality" | "ws">("reality");
  const [ssh, setSsh] = useState<SshForm>(initialSsh);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  function set<K extends keyof typeof initial>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const defaultPort = protocol === "vless" ? "443" : "51820";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        host: form.host,
        country: form.country,
        city: form.city,
        protocol,
        ...(form.port ? { port: Number(form.port) } : {}),
        ...(protocol === "vless" ? { transport } : {}),
        ...(protocol === "vless" && transport === "reality" && form.sni ? { sni: form.sni } : {}),
        ...(protocol === "vless" && transport === "ws" && form.domain ? { domain: form.domain } : {}),
        ssh: sshPayload(ssh),
      }),
    });
    setLoading(false);
    if (res.ok) {
      setCreated(true);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Не удалось создать сервер");
    }
  }

  function close() {
    setOpen(false);
    setForm(initial);
    setProtocol("wireguard");
    setTransport("reality");
    setSsh(initialSsh);
    setError(null);
    setCreated(false);
  }

  const inputCls =
    "w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-[#3987e5]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2a78d6]"
      >
        + Добавить сервер
      </button>

      <Modal open={open} onClose={close} title={created ? "Установка началась" : "Новый сервер"}>
        {created ? (
          <div>
            <p className="mb-4 text-sm text-slate-400">
              Панель подключается к серверу по SSH и устанавливает{" "}
              {protocol === "vless"
                ? "Xray (VLESS + Reality)"
                : protocol === "awg"
                  ? "AmneziaWG"
                  : "WireGuard"}
              , настраивает сеть и
              запускает агента. Обычно это занимает 1–3 минуты — статус в таблице обновится
              автоматически.
            </p>
            <button
              onClick={close}
              className="w-full rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a78d6]"
            >
              Понятно
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Протокол</label>
              <div className="grid gap-2">
                <ProtocolTile
                  active={protocol === "wireguard"}
                  onClick={() => setProtocol("wireguard")}
                  title="WireGuard"
                  desc="Быстрый, лучший для мобильных. Легко детектируется DPI."
                />
                <ProtocolTile
                  active={protocol === "awg"}
                  onClick={() => setProtocol("awg")}
                  title="AmneziaWG"
                  desc="WireGuard с обфускацией: junk-пакеты и случайные заголовки против DPI."
                />
                <ProtocolTile
                  active={protocol === "vless"}
                  onClick={() => setProtocol("vless")}
                  title="VLESS + Reality"
                  desc="Обход блокировок, маскировка под настоящий HTTPS-сайт."
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Название</label>
              <input
                required
                className={inputCls}
                placeholder="Amsterdam-1"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-slate-400">IP или домен</label>
                <input
                  required
                  className={inputCls}
                  placeholder="185.10.20.30"
                  value={form.host}
                  onChange={(e) => set("host", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Порт</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  className={inputCls}
                  placeholder={defaultPort}
                  value={form.port}
                  onChange={(e) => set("port", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Страна (ISO)</label>
                <input
                  required
                  maxLength={2}
                  className={inputCls}
                  placeholder="NL"
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Город</label>
                <input
                  className={inputCls}
                  placeholder="Амстердам"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
            </div>

            {protocol === "vless" && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Транспорт</label>
                  <div className="grid grid-cols-2 gap-2">
                    <ProtocolTile
                      active={transport === "reality"}
                      onClick={() => setTransport("reality")}
                      title="Reality (прямое)"
                      desc="Маскировка под чужой HTTPS-сайт. Без домена."
                    />
                    <ProtocolTile
                      active={transport === "ws"}
                      onClick={() => setTransport("ws")}
                      title="CDN (WebSocket)"
                      desc="Вход через Cloudflare, скрывает IP ноды. Нужен домен."
                    />
                  </div>
                </div>

                {transport === "reality" ? (
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Домен маскировки (SNI)</label>
                    <input
                      className={inputCls}
                      placeholder={DEFAULT_REALITY_SNI}
                      value={form.sni}
                      onChange={(e) => set("sni", e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Под этот сайт маскируется трафик. Нужен популярный HTTPS-сайт с TLS 1.3,
                      которого нет в списке блокировок (например {DEFAULT_REALITY_SNI}). Оставьте
                      пустым — панель подберёт случайный домен из пула (у разных нод — разный).
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Домен за Cloudflare</label>
                    <input
                      required
                      className={inputCls}
                      placeholder="vpn.example.com"
                      value={form.domain}
                      onChange={(e) => set("domain", e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Заранее в Cloudflare: A-запись {form.domain || "vpn.example.com"} → IP этой ноды,
                      прокси включён (оранжевое облако), SSL — «Flexible». Origin слушает ws на порту 80,
                      CDN терминирует TLS. Голый IP ноды не светится.
                    </p>
                  </div>
                )}
              </>
            )}

            <SshFields value={ssh} onChange={setSsh} />

            <p className="text-xs text-slate-500">
              Панель сама установит{" "}
              {protocol === "vless" ? "Xray" : protocol === "awg" ? "AmneziaWG" : "WireGuard"} и агента на
              сервер (Debian/Ubuntu) и получит ключи для клиентов.
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a78d6] disabled:opacity-50"
            >
              {loading ? "Создание..." : "Добавить и установить"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}

function ProtocolTile({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition ${
        active
          ? "border-[#3987e5] bg-[#3987e5]/10"
          : "border-surface-border hover:border-slate-500"
      }`}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
    </button>
  );
}
