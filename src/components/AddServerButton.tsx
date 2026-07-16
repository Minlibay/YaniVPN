"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { SshFields, initialSsh, sshPayload, type SshForm } from "./SshFields";

const initial = { name: "", host: "", port: "51820", country: "", city: "" };

export function AddServerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [ssh, setSsh] = useState<SshForm>(initialSsh);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  function set<K extends keyof typeof initial>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, port: Number(form.port), ssh: sshPayload(ssh) }),
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
              Панель подключается к серверу по SSH и устанавливает WireGuard, настраивает сеть и
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
                <label className="mb-1 block text-xs text-slate-400">Порт WG</label>
                <input
                  required
                  type="number"
                  min={1}
                  max={65535}
                  className={inputCls}
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

            <SshFields value={ssh} onChange={setSsh} />

            <p className="text-xs text-slate-500">
              Панель сама установит WireGuard и агента на сервер (Debian/Ubuntu) и получит его
              публичный ключ.
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
