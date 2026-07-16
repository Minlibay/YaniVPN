import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accountUsage, generateAccountCode } from "@/lib/account";

// Регистрация без ввода данных: приложение при первом запуске создаёт аккаунт
// и получает конфигурационный код. Код — единственный секрет пользователя.
export async function POST() {
  let code = generateAccountCode();
  // крайне маловероятная коллизия — перегенерируем
  for (let i = 0; i < 3; i++) {
    const exists = await prisma.account.findUnique({ where: { code } });
    if (!exists) break;
    code = generateAccountCode();
  }

  const account = await prisma.account.create({ data: { code } });
  const usage = await accountUsage(account);

  return NextResponse.json({ code: account.code, ...usage }, { status: 201 });
}
