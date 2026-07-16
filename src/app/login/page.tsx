"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        // Полная перезагрузка вместо client-side навигации: middleware
        // гарантированно увидит свежую сессионную куку.
        window.location.assign("/");
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Ошибка входа");
      setLoading(false);
    } catch {
      setError("Сервер недоступен, попробуйте ещё раз");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold tracking-tight">
            Yani<span className="text-[#3987e5]">VPN</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">Панель управления</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-surface-border bg-surface-raised p-6 shadow-xl"
        >
          <label className="mb-1 block text-sm text-slate-400" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-[#3987e5]"
            placeholder="admin@yanivpn.local"
          />
          <label className="mb-1 block text-sm text-slate-400" htmlFor="password">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-[#3987e5]"
            placeholder="••••••••"
          />
          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#3987e5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2a78d6] disabled:opacity-50"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </main>
  );
}
