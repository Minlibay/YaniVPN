import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accountFromRequest, accountUsage } from "@/lib/account";

const schema = z.object({
  // Чек покупки из App Store / Google Play. В этой версии не проверяется —
  // см. предупреждение ниже.
  receipt: z.string().min(1).max(10000),
  platform: z.enum(["ios", "android"]).optional(),
});

// ЗАГЛУШКА оплаты. В продакшене здесь ОБЯЗАТЕЛЬНА серверная валидация чека
// (App Store Server API / Google Play Developer API): без неё любой может
// выдать себе платный план. Поэтому эндпоинт работает только при явно
// выставленном ALLOW_MOCK_PURCHASE=1 (для разработки).
export async function POST(req: NextRequest) {
  if (process.env.ALLOW_MOCK_PURCHASE !== "1") {
    return NextResponse.json(
      { error: "Оплата не подключена. Требуется валидация чека магазина." },
      { status: 501 }
    );
  }

  const account = await accountFromRequest(req);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!schema.safeParse(body).success) {
    return NextResponse.json({ error: "Нужен чек покупки" }, { status: 400 });
  }

  const updated = await prisma.account.update({
    where: { id: account.id },
    data: { plan: "paid" },
  });
  // Возвращаем отключённые по лимиту пиры в строй.
  await prisma.peer.updateMany({
    where: { accountId: account.id, enabled: false },
    data: { enabled: true },
  });

  return NextResponse.json({ ok: true, ...(await accountUsage(updated)) });
}
