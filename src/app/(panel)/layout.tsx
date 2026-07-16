import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { NavLink } from "@/components/NavLink";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-surface-border bg-surface-raised">
        <Link href="/" className="px-6 py-5 text-xl font-bold tracking-tight">
          Yani<span className="text-[#3987e5]">VPN</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <NavLink href="/">Дашборд</NavLink>
          <NavLink href="/servers">Серверы</NavLink>
          <NavLink href="/clients">Клиенты</NavLink>
        </nav>
        <div className="border-t border-surface-border p-4">
          <p className="mb-2 truncate text-xs text-slate-500" title={session.email}>
            {session.email}
          </p>
          <LogoutButton />
        </div>
      </aside>
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
