"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { CopyField } from "./CopyField";

const initial = { name: "", host: "", port: "51820", country: "", city: "", publicKey: "" };

export function AddServerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

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
      body: JSON.stringify({ ...form, port: Number(form.port) }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setCreatedToken(data.apiToken);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Не удалось создать сервер");
    }
  }

  function close() {
    setOpen(false);
    setForm(initial);
    setError(null);
    setCreatedToken(null);
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

      <Modal open={open} onClose={close} title={createdToken ? "Сервер добавлен" : "Новый сервер"}>
        {createdToken ? (
          <div>
            <p className="mb-3 text-sm text-slate-400">
              Токен агента для этой ноды. Он показывается <b>только один раз</b> — сохраните его и
              пропишите в конфигурации агента:
            </p>
            <CopyField value={createdToken} mono />
            <button
              onClick={close}
              className="mt-4 w-full rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a78d6]"
            >
              Готово
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-3">
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
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Публичный ключ WireGuard-интерфейса сервера
              </label>
              <input
                required
                className={`${inputCls} font-mono`}
                placeholder="Base64-ключ из `wg show wg0 public-key`"
                value={form.publicKey}
                onChange={(e) => set("publicKey", e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a78d6] disabled:opacity-50"
            >
              {loading ? "Создание..." : "Создать сервер"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
