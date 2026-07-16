"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { CopyField } from "./CopyField";
import { SshFields, initialSsh, sshPayload, type SshForm } from "./SshFields";

export function ServerActions({
  serverId,
  serverName,
  apiToken,
  status,
  provisionError,
}: {
  serverId: string;
  serverName: string;
  apiToken: string;
  status: string;
  provisionError: string | null;
}) {
  const router = useRouter();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [ssh, setSsh] = useState<SshForm>(initialSsh);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    setBusy(true);
    await fetch(`/api/servers/${serverId}`, { method: "DELETE" });
    setBusy(false);
    setDeleteOpen(false);
    router.refresh();
  }

  async function onRetry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRetryError(null);
    const res = await fetch(`/api/servers/${serverId}/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssh: sshPayload(ssh) }),
    });
    setBusy(false);
    if (res.ok) {
      setRetryOpen(false);
      setSsh(initialSsh);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setRetryError(data?.error ?? "Не удалось запустить установку");
    }
  }

  return (
    <div className="flex justify-end gap-2">
      {status === "error" && (
        <button
          onClick={() => setRetryOpen(true)}
          className="rounded-lg border border-amber-700/60 px-2.5 py-1 text-xs text-amber-400 hover:bg-amber-500/10"
        >
          Ошибка установки
        </button>
      )}
      <button
        onClick={() => setTokenOpen(true)}
        className="rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200"
      >
        Токен
      </button>
      <button
        onClick={() => setDeleteOpen(true)}
        className="rounded-lg border border-red-900/60 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
      >
        Удалить
      </button>

      <Modal open={tokenOpen} onClose={() => setTokenOpen(false)} title={`Токен агента — ${serverName}`}>
        <p className="mb-3 text-sm text-slate-400">
          При автоустановке токен уже прописан агенту. Нужен только для ручной настройки
          (заголовок <code className="text-xs">Authorization: Bearer ...</code>):
        </p>
        <CopyField value={apiToken} mono />
      </Modal>

      <Modal open={retryOpen} onClose={() => setRetryOpen(false)} title={`Установка — ${serverName}`}>
        {provisionError && (
          <>
            <p className="mb-2 text-sm text-slate-400">Лог последней попытки:</p>
            <pre className="mb-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-surface-border bg-surface p-3 font-mono text-xs text-red-300">
              {provisionError}
            </pre>
          </>
        )}
        <form onSubmit={onRetry} className="grid gap-3">
          <SshFields value={ssh} onChange={setSsh} />
          {retryError && <p className="text-sm text-red-400">{retryError}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a78d6] disabled:opacity-50"
          >
            {busy ? "Запуск..." : "Повторить установку"}
          </button>
        </form>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Удалить сервер?">
        <p className="mb-4 text-sm text-slate-400">
          Сервер <b className="text-slate-200">{serverName}</b> и все его клиенты будут удалены.
          Это действие необратимо.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onDelete}
            disabled={busy}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Удаление..." : "Удалить"}
          </button>
          <button
            onClick={() => setDeleteOpen(false)}
            className="flex-1 rounded-lg border border-surface-border px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Отмена
          </button>
        </div>
      </Modal>
    </div>
  );
}
