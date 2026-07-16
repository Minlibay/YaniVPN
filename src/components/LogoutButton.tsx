"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="w-full rounded-lg border border-surface-border px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
    >
      Выйти
    </button>
  );
}
