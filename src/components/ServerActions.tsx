"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { CopyField } from "./CopyField";

export function ServerActions({
  serverId,
  serverName,
  apiToken,
}: {
  serverId: string;
  serverName: string;
  apiToken: string;
}) {
  const router = useRouter();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    await fetch(`/api/servers/${serverId}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
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
          Используется агентом ноды для отправки статистики (заголовок{" "}
          <code className="text-xs">Authorization: Bearer ...</code>):
        </p>
        <CopyField value={apiToken} mono />
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Удалить сервер?">
        <p className="mb-4 text-sm text-slate-400">
          Сервер <b className="text-slate-200">{serverName}</b> и все его клиенты будут удалены.
          Это действие необратимо.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onDelete}
            disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Удаление..." : "Удалить"}
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
