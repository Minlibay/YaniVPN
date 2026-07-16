"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";

export function AddClientButton({ servers }: { servers: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [serverId, setServerId] = useState(servers[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/peers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, serverId }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setConfig(data.config);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Не удалось создать клиента");
    }
  }

  function close() {
    setOpen(false);
    setName("");
    setError(null);
    setConfig(null);
  }

  function download() {
    if (!config) return;
    const blob = new Blob([config], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "client"}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputCls =
    "w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-[#3987e5]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2a78d6]"
      >
        + Добавить клиента
      </button>

      <Modal open={open} onClose={close} title={config ? "Конфигурация клиента" : "Новый клиент"}>
        {config ? (
          <div>
            <p className="mb-3 text-sm text-slate-400">
              Готовый конфиг WireGuard. Приватный ключ <b>не сохраняется на сервере</b> — скачайте
              или скопируйте конфиг сейчас:
            </p>
            <pre className="mb-4 max-h-64 overflow-auto rounded-lg border border-surface-border bg-surface p-3 font-mono text-xs leading-relaxed">
              {config}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={download}
                className="flex-1 rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a78d6]"
              >
                Скачать .conf
              </button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(config);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex-1 rounded-lg border border-surface-border px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Имя клиента</label>
              <input
                required
                className={inputCls}
                placeholder="iphone-ivan"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Сервер</label>
              <select
                required
                className={inputCls}
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {servers.length === 0 && (
              <p className="text-sm text-amber-400">Сначала добавьте хотя бы один сервер.</p>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || servers.length === 0}
              className="mt-1 rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a78d6] disabled:opacity-50"
            >
              {loading ? "Создание..." : "Создать и получить конфиг"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
