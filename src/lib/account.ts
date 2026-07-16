import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "./db";

// Конфигурационный код: человекочитаемый секрет в группах, который легко
// перенести между устройствами. Пример: YANI-3F2A-9C7B-1D4E-8A0F.
export function generateAccountCode(): string {
  const hex = randomBytes(8).toString("hex").toUpperCase();
  const groups = hex.match(/.{1,4}/g) ?? [hex];
  return `YANI-${groups.join("-")}`;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

// Аккаунт, авторизованный по заголовку Authorization: Bearer <code>.
export async function accountFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const code = auth.startsWith("Bearer ") ? normalizeCode(auth.slice(7)) : null;
  if (!code) return null;
  return prisma.account.findUnique({ where: { code } });
}

export type Usage = {
  dataUsed: number;
  dataLimit: number;
  plan: string;
  remaining: number;
  exhausted: boolean;
};

// Использовано = суммарный трафик всех пиров аккаунта (rx + tx).
// Лимит действует только на бесплатном плане.
export async function accountUsage(account: {
  id: string;
  plan: string;
  dataLimit: bigint;
}): Promise<Usage> {
  const agg = await prisma.peer.aggregate({
    where: { accountId: account.id },
    _sum: { rxBytes: true, txBytes: true },
  });
  const dataUsed = Number((agg._sum.rxBytes ?? 0n) + (agg._sum.txBytes ?? 0n));
  const dataLimit = Number(account.dataLimit);
  const unlimited = account.plan !== "free";
  const remaining = unlimited ? Infinity : Math.max(0, dataLimit - dataUsed);
  return {
    dataUsed,
    dataLimit,
    plan: account.plan,
    remaining: unlimited ? -1 : remaining,
    exhausted: !unlimited && dataUsed >= dataLimit,
  };
}
