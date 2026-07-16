"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";

export function PeerActions({
  peerId,
  peerName,
  enabled,
}: {
  peerId: string;
  peerName: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/peers/${peerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setBusy(false);
    router.refresh();
  }

  async function onDelete() {
    setBusy(true);
    await fetch(`/api/peers/${peerId}`, { method: "DELETE" });
    setBusy(false);
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className="rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-50"
      >
        {enabled ? "Отключить" : "Включить"}
      </button>
      <button
        onClick={() => setDeleteOpen(true)}
        className="rounded-lg border border-red-900/60 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
      >
        Удалить
      </button>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Удалить клиента?">
        <p className="mb-4 text-sm text-slate-400">
          Клиент <b className="text-slate-200">{peerName}</b> будет удалён, его конфиг перестанет
          работать после синхронизации агента.
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
