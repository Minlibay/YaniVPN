import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accountUsage, normalizeCode } from "@/lib/account";

const schema = z.object({ code: z.string().min(1).max(100) });

// Вход по коду с другого устройства: проверяет код и возвращает состояние
// аккаунта. Квота общая для всех устройств одного кода.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный код" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({
    where: { code: normalizeCode(parsed.data.code) },
  });
  if (!account) {
    return NextResponse.json({ error: "Код не найден" }, { status: 404 });
  }

  const usage = await accountUsage(account);
  return NextResponse.json({ code: account.code, ...usage });
}
